/** Per-family OpenCode Go thinking levels and plugin-owned defaults. */

import type { LlmResolvedModelInfo, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { ModelThinkingLevel, ThinkingLevelMap } from '@earendil-works/pi-ai'
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts'
import { familyForModel } from './catalog.ts'

const UNSUPPORTED = null

function pin(supported: Partial<Record<ModelThinkingLevel, string>>): ThinkingLevelMap {
  return {
    off: supported.off ?? UNSUPPORTED,
    minimal: supported.minimal ?? UNSUPPORTED,
    low: supported.low ?? UNSUPPORTED,
    medium: supported.medium ?? UNSUPPORTED,
    high: supported.high ?? UNSUPPORTED,
    xhigh: supported.xhigh ?? UNSUPPORTED,
    max: supported.max ?? UNSUPPORTED,
  }
}

const OFF_HIGH = pin({ off: 'none', high: 'high' })
const OFF_HIGH_MAX = pin({ off: 'none', high: 'high', max: 'max' })
const OFF_LOW_HIGH_MAX = pin({ off: 'none', low: 'low', high: 'high', max: 'max' })
const LOW_MEDIUM_HIGH = pin({ low: 'low', medium: 'medium', high: 'high' })
const LOW_MEDIUM_HIGH_XHIGH = pin({ low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' })
const LOW_MEDIUM_HIGH_XHIGH_MAX = pin({ low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' })
const LOW_MEDIUM_XHIGH = pin({ low: 'low', medium: 'medium', xhigh: 'xhigh' })
const LOW_HIGH_MAX = pin({ low: 'low', high: 'high', max: 'max' })
const HIGH_MAX = pin({ high: 'high', max: 'max' })
const HIGH_ONLY = pin({ high: 'high' })
const MINIMAL_TO_XHIGH = pin({ minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' })
/** Canonical ordering used by pi-ai and the settings UI. */
export const OPENCODE_GO_EFFORT_ORDER: readonly ModelThinkingLevel[] = [
  'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
] as const

interface FamilyPolicy {
  levels: ThinkingLevelMap
  defaultEffort?: ModelThinkingLevel
}

const FAMILIES: Partial<Record<ReturnType<typeof familyForModel>, FamilyPolicy>> = {
  grok: { levels: LOW_MEDIUM_HIGH_XHIGH, defaultEffort: 'high' },
  gpt: { levels: LOW_MEDIUM_HIGH_XHIGH_MAX, defaultEffort: 'medium' },
  muse: { levels: MINIMAL_TO_XHIGH, defaultEffort: 'xhigh' },
  glm: { levels: LOW_HIGH_MAX, defaultEffort: 'max' },
  kimi: { levels: LOW_HIGH_MAX, defaultEffort: 'max' },
  qwen: { levels: OFF_HIGH, defaultEffort: 'high' },
  deepseek: { levels: OFF_LOW_HIGH_MAX, defaultEffort: 'max' },
  mimo: { levels: LOW_MEDIUM_XHIGH, defaultEffort: 'xhigh' },
  hy3: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  minimax: { levels: HIGH_ONLY, defaultEffort: 'high' },
  longcat: { levels: OFF_HIGH, defaultEffort: 'high' },
}

const MODEL_POLICIES: Readonly<Record<string, FamilyPolicy>> = {
  // These models publish effort sets that differ from their broader family.
  'grok-4.6': { levels: LOW_MEDIUM_HIGH_XHIGH, defaultEffort: 'high' },
  'grok-4.5': { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  'hy4-preview': { levels: OFF_HIGH, defaultEffort: 'high' },
  'qwen3.8-flash': { levels: LOW_MEDIUM_XHIGH, defaultEffort: 'xhigh' },
  // OpenCode currently rejects `max` for Muse Spark 1.3, but the forward
  // catalog entry intentionally preserves the requested wire spelling.
  'muse-spark-1.3-contributor': { levels: pin({ minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' }), defaultEffort: 'max' },
  'omen-alpha': { levels: pin({ low: 'low', high: 'high' }), defaultEffort: 'high' },
}

function classifyPolicy(model: string): FamilyPolicy {
  const id = model.toLowerCase()
  const exact = MODEL_POLICIES[id]
  if (exact !== undefined) return exact
  if (id.startsWith('glm-5.3')) return { levels: LOW_HIGH_MAX, defaultEffort: 'max' }
  if (id.startsWith('glm-5.2')) return { levels: OFF_HIGH_MAX, defaultEffort: 'max' }
  if (id.startsWith('glm-5.1')) return { levels: OFF_HIGH, defaultEffort: 'high' }
  if (id === 'glm-5' || id.startsWith('glm-5-')) return { levels: OFF_HIGH, defaultEffort: 'high' }
  if (id.startsWith('kimi-k3')) return { levels: LOW_HIGH_MAX, defaultEffort: 'max' }
  if (id.startsWith('kimi-k2.7')) return { levels: HIGH_ONLY, defaultEffort: 'high' }
  if (id.startsWith('kimi-k2.6')) return { levels: OFF_HIGH, defaultEffort: 'high' }
  if (id.startsWith('kimi-k2.5')) return { levels: LOW_HIGH_MAX, defaultEffort: 'max' }
  if (id.startsWith('qwen3.8')) return { levels: LOW_MEDIUM_XHIGH, defaultEffort: 'xhigh' }
  if (id.startsWith('qwen3.7') || id.startsWith('qwen3.6') || id.startsWith('qwen3.5')) {
    return { levels: OFF_HIGH, defaultEffort: 'high' }
  }
  if (id.startsWith('mimo-')) return { levels: LOW_MEDIUM_XHIGH, defaultEffort: 'xhigh' }
  if (id.startsWith('hy4')) return { levels: OFF_HIGH, defaultEffort: 'high' }
  if (id === 'hy3' || id.startsWith('hy3-')) return { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' }
  if (id.startsWith('minimax-m3')) return { levels: OFF_HIGH, defaultEffort: 'high' }
  if (id.startsWith('minimax-')) return { levels: HIGH_ONLY, defaultEffort: 'high' }
  if (id.startsWith('longcat-')) return { levels: OFF_HIGH, defaultEffort: 'high' }
  if (id.includes('vision') && id.startsWith('deepseek-v4-flash')) return { levels: HIGH_MAX, defaultEffort: 'max' }
  if (id.startsWith('deepseek-')) return { levels: OFF_LOW_HIGH_MAX, defaultEffort: 'max' }
  return FAMILIES[familyForModel(model)] ?? { levels: OFF_HIGH, defaultEffort: 'high' }
}

function policyFor(model: string): FamilyPolicy {
  return classifyPolicy(model)
}

/** Map a models.dev / wire effort token onto the plugin's level ids. */
export function canonOpenCodeGoEffort(value: string): ModelThinkingLevel | undefined {
  const key = value === 'none' ? 'off' : value
  return (OPENCODE_GO_EFFORT_ORDER as readonly string[]).includes(key) ? key as ModelThinkingLevel : undefined
}

function levelsFromRow(model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinkingEfforts'>): ThinkingLevelMap {
  const listed = model.thinkingEfforts
  if (listed === undefined || listed.length === 0) return policyFor(model.id).levels
  const supported: Partial<Record<ModelThinkingLevel, string>> = {}
  for (const raw of listed) {
    const level = canonOpenCodeGoEffort(raw)
    if (level === undefined) continue
    supported[level] = level === 'off' ? 'none' : level
  }
  if (OPENCODE_GO_EFFORT_ORDER.every(level => supported[level] === undefined)) return policyFor(model.id).levels
  return pin(supported)
}

/** Supported thinking levels for one catalog row, in canonical order. */
export function openCodeGoSupportedEfforts(
  model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking' | 'thinkingEfforts'>,
): readonly ModelThinkingLevel[] {
  if (model.thinking !== true) return []
  const levels = levelsFromRow(model)
  return OPENCODE_GO_EFFORT_ORDER.filter(level => levels[level] !== null && levels[level] !== undefined)
}

/** Thinking-level map for one catalog row, or undefined when thinking is off. */
export function openCodeGoThinkingLevelMap(model: OpenCodeGoCatalogModelConfig): ThinkingLevelMap | undefined {
  if (model.thinking !== true) return undefined
  return levelsFromRow(model)
}

/** Plugin-owned default effort for a known family. */
export function openCodeGoDefaultEffort(model: string): ModelThinkingLevel | undefined {
  return policyFor(model).defaultEffort
}

/** Display name for one effort id (e.g. "high" -> "High", "xhigh" -> "Xhigh"). */
export function formatEffortName(level: ModelThinkingLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

/** Effective default for a draft row: explicit if valid, else family default, else first supported. */
export function resolveEffectiveDefaultEffort(
  model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking' | 'thinkingEfforts'> & { defaultEffort?: string },
): ModelThinkingLevel | undefined {
  if (model.thinking !== true) return undefined
  const explicit = model.defaultEffort as ModelThinkingLevel | undefined
  if (explicit !== undefined) {
    const supported = openCodeGoSupportedEfforts(model)
    if ((supported as readonly string[]).includes(explicit)) return explicit
  }
  return openCodeGoDefaultEffort(model.id) ?? openCodeGoSupportedEfforts(model)[0]
}

/** Whether an explicit effort is valid for the model's family. */
export function isValidEffortForModel(
  model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking' | 'thinkingEfforts'>,
  effort: string,
): boolean {
  if (model.thinking !== true) return false
  return (openCodeGoSupportedEfforts(model) as readonly string[]).includes(effort)
}

/** Attach the family or row default to a resolved model when that level is offered. */
export function applyOpenCodeGoReasoningMetadata(
  info: LlmResolvedModelInfo,
  model: string,
  override?: string,
): LlmResolvedModelInfo {
  if (info.reasoning === undefined) return info
  const preferred = override ?? openCodeGoDefaultEffort(model)
  if (preferred === undefined) return info
  const defaultEffort = preferred as ReasoningEffortId
  if (!info.reasoning.efforts.some(effort => effort.id === defaultEffort)) return info
  return { ...info, reasoning: { ...info.reasoning, defaultEffort } }
}
