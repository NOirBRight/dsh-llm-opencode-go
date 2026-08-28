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

const OFF_HIGH_MAX = pin({ off: 'none', high: 'high', max: 'max' })
const OFF_LOW_HIGH_MAX = pin({ off: 'none', low: 'low', high: 'high', max: 'max' })
const LOW_MEDIUM_HIGH = pin({ low: 'low', medium: 'medium', high: 'high' })
const LOW_MEDIUM_HIGH_XHIGH_MAX = pin({ low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' })
const MINIMAL_TO_XHIGH = pin({ minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' })
const GENERIC = pin({ off: 'none', low: 'low', medium: 'medium', high: 'high', max: 'max' })

/** Canonical ordering used by pi-ai and the settings UI. */
export const OPENCODE_GO_EFFORT_ORDER: readonly ModelThinkingLevel[] = [
  'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
] as const

interface FamilyPolicy {
  levels: ThinkingLevelMap
  defaultEffort?: ModelThinkingLevel
}

const FAMILIES: Partial<Record<ReturnType<typeof familyForModel>, FamilyPolicy>> = {
  grok: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  gpt: { levels: LOW_MEDIUM_HIGH_XHIGH_MAX, defaultEffort: 'medium' },
  muse: { levels: MINIMAL_TO_XHIGH, defaultEffort: 'xhigh' },
  glm: { levels: OFF_HIGH_MAX, defaultEffort: 'max' },
  kimi: { levels: OFF_LOW_HIGH_MAX, defaultEffort: 'max' },
  qwen: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  deepseek: { levels: OFF_LOW_HIGH_MAX, defaultEffort: 'max' },
  mimo: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  hy3: { levels: pin({ off: 'none', low: 'low', high: 'high' }), defaultEffort: 'high' },
  minimax: { levels: GENERIC, defaultEffort: 'max' },
  longcat: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
}

function policyFor(model: string): FamilyPolicy {
  return FAMILIES[familyForModel(model)] ?? { levels: GENERIC, defaultEffort: 'medium' }
}

/** Supported thinking levels for one catalog row, in canonical order. */
export function openCodeGoSupportedEfforts(
  model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking'>,
): readonly ModelThinkingLevel[] {
  if (model.thinking !== true) return []
  const levels = policyFor(model.id).levels
  return OPENCODE_GO_EFFORT_ORDER.filter(level => levels[level] !== null && levels[level] !== undefined)
}

/** Thinking-level map for one catalog row, or undefined when thinking is off. */
export function openCodeGoThinkingLevelMap(model: OpenCodeGoCatalogModelConfig): ThinkingLevelMap | undefined {
  if (model.thinking !== true) return undefined
  return policyFor(model.id).levels
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
  model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking'> & { defaultEffort?: string },
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
  model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking'>,
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