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

interface FamilyPolicy {
  levels: ThinkingLevelMap
  defaultEffort?: ModelThinkingLevel
}

const FAMILIES: Partial<Record<ReturnType<typeof familyForModel>, FamilyPolicy>> = {
  grok: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  gpt: { levels: LOW_MEDIUM_HIGH_XHIGH_MAX, defaultEffort: 'medium' },
  muse: { levels: MINIMAL_TO_XHIGH, defaultEffort: 'medium' },
  glm: { levels: OFF_HIGH_MAX, defaultEffort: 'max' },
  kimi: { levels: OFF_LOW_HIGH_MAX, defaultEffort: 'max' },
  qwen: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'high' },
  deepseek: { levels: OFF_LOW_HIGH_MAX, defaultEffort: 'high' },
  mimo: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'medium' },
  hy3: { levels: pin({ off: 'none', low: 'low', high: 'high' }), defaultEffort: 'high' },
  longcat: { levels: LOW_MEDIUM_HIGH, defaultEffort: 'medium' },
}

function policyFor(model: string): FamilyPolicy {
  return FAMILIES[familyForModel(model)] ?? { levels: GENERIC }
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
