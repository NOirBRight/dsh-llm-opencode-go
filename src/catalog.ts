/** Documented OpenCode Go metadata used when GET /models has no capacities. */

import type { OpenCodeGoApi, OpenCodeGoCatalogModelConfig } from './client-contract.ts'

export type OpenCodeGoFamily =
  | 'grok' | 'gpt' | 'glm' | 'kimi' | 'qwen' | 'deepseek'
  | 'minimax' | 'mimo' | 'hy3' | 'longcat' | 'muse' | 'other'

export interface OpenCodeGoKnownModel {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  api: OpenCodeGoApi
  vision: boolean
  thinking: boolean
  defaultEffort?: string
  family: OpenCodeGoFamily
}

const KNOWN: readonly OpenCodeGoKnownModel[] = [
  { id: 'grok-4.6', name: 'Grok 4.6', contextWindow: 500_000, maxTokens: 500_000, api: 'openai-responses', vision: true, thinking: true, defaultEffort: 'high', family: 'grok' },
  { id: 'grok-4.5', name: 'Grok 4.5', contextWindow: 500_000, maxTokens: 500_000, api: 'openai-responses', vision: true, thinking: true, defaultEffort: 'high', family: 'grok' },
  { id: 'gpt-5.6-luna', name: 'GPT 5.6 Luna', contextWindow: 1_050_000, maxTokens: 128_000, api: 'openai-responses', vision: true, thinking: true, defaultEffort: 'max', family: 'gpt' },
  { id: 'muse-spark-1.2-contributor', name: 'Muse Spark 1.2 Contributor', contextWindow: 1_048_576, maxTokens: 131_072, api: 'openai-responses', vision: true, thinking: true, defaultEffort: 'xhigh', family: 'muse' },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', contextWindow: 1_000_000, maxTokens: 131_072, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'high', family: 'glm' },
  { id: 'glm-5.3', name: 'GLM-5.3', contextWindow: 1_000_000, maxTokens: 131_072, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'max', family: 'glm' },
  { id: 'glm-5.2', name: 'GLM-5.2', contextWindow: 1_000_000, maxTokens: 131_072, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'max', family: 'glm' },
  { id: 'glm-5.1', name: 'GLM-5.1', contextWindow: 202_752, maxTokens: 32_768, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'glm' },
  { id: 'glm-5', name: 'GLM-5', contextWindow: 202_752, maxTokens: 131_072, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'glm' },
  { id: 'kimi-k3', name: 'Kimi K3', contextWindow: 1_048_576, maxTokens: 131_072, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'high', family: 'kimi' },
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', contextWindow: 262_144, maxTokens: 262_144, api: 'openai-completions', vision: true, thinking: false, family: 'kimi' },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', contextWindow: 262_144, maxTokens: 65_536, api: 'openai-completions', vision: true, thinking: false, family: 'kimi' },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', contextWindow: 262_144, maxTokens: 65_536, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'max', family: 'kimi' },
  { id: 'longcat-2.0', name: 'LongCat-2.0', contextWindow: 1_000_000, maxTokens: 131_072, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'longcat' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 1_000_000, maxTokens: 384_000, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'max', family: 'deepseek' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 1_000_000, maxTokens: 384_000, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'max', family: 'deepseek' },
  { id: 'deepseek-v4-flash-vision-exp', name: 'DeepSeek V4 Flash Vision Exp', contextWindow: 1_000_000, maxTokens: 384_000, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'max', family: 'deepseek' },
  { id: 'mimo-v2.5', name: 'MiMo-V2.5', contextWindow: 1_000_000, maxTokens: 128_000, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'high', family: 'mimo' },
  { id: 'mimo-v2.5-pro', name: 'MiMo-V2.5-Pro', contextWindow: 1_048_576, maxTokens: 128_000, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'mimo' },
  { id: 'mimo-v2-pro', name: 'MiMo-V2-Pro', contextWindow: 1_048_576, maxTokens: 131_072, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'mimo' },
  { id: 'mimo-v2-omni', name: 'MiMo-V2-Omni', contextWindow: 262_144, maxTokens: 65_536, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'high', family: 'mimo' },
  { id: 'hy3', name: 'Hy3', contextWindow: 256_000, maxTokens: 64_000, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'hy3' },
  { id: 'hy3-preview', name: 'Hy3 Preview', contextWindow: 256_000, maxTokens: 64_000, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'hy3' },
  { id: 'minimax-m3', name: 'MiniMax M3', contextWindow: 1_000_000, maxTokens: 131_072, api: 'anthropic-messages', vision: true, thinking: true, defaultEffort: 'max', family: 'minimax' },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', contextWindow: 204_800, maxTokens: 131_072, api: 'anthropic-messages', vision: false, thinking: true, defaultEffort: 'max', family: 'minimax' },
  { id: 'minimax-m2.5', name: 'MiniMax M2.5', contextWindow: 204_800, maxTokens: 131_072, api: 'anthropic-messages', vision: false, thinking: true, defaultEffort: 'max', family: 'minimax' },
  { id: 'qwen3.8-max', name: 'Qwen3.8 Max', contextWindow: 1_000_000, maxTokens: 131_072, api: 'anthropic-messages', vision: true, thinking: true, defaultEffort: 'high', family: 'qwen' },
  { id: 'qwen3.7-max', name: 'Qwen3.7 Max', contextWindow: 1_000_000, maxTokens: 65_536, api: 'anthropic-messages', vision: false, thinking: true, defaultEffort: 'high', family: 'qwen' },
  { id: 'qwen3.7-plus', name: 'Qwen3.7 Plus', contextWindow: 1_000_000, maxTokens: 65_536, api: 'anthropic-messages', vision: true, thinking: true, defaultEffort: 'high', family: 'qwen' },
  { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus', contextWindow: 1_000_000, maxTokens: 65_536, api: 'anthropic-messages', vision: true, thinking: true, defaultEffort: 'high', family: 'qwen' },
  { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', contextWindow: 262_144, maxTokens: 65_536, api: 'anthropic-messages', vision: true, thinking: true, defaultEffort: 'high', family: 'qwen' },
  { id: 'hy4-preview', name: 'Hy4 preview', contextWindow: 1_024_000, maxTokens: 64_000, api: 'openai-completions', vision: false, thinking: true, defaultEffort: 'high', family: 'hy3' },
  { id: 'qwen3.8-flash', name: 'Qwen3.8 Flash', contextWindow: 1_000_000, maxTokens: 131_072, api: 'anthropic-messages', vision: true, thinking: true, defaultEffort: 'xhigh', family: 'qwen' },
  { id: 'muse-spark-1.3-contributor', name: 'Muse Spark 1.3 Contributor', contextWindow: 1_048_576, maxTokens: 131_072, api: 'openai-responses', vision: true, thinking: true, defaultEffort: 'max', family: 'muse' },
  { id: 'omen-alpha', name: 'Omen Alpha', contextWindow: 500_000, maxTokens: 128_000, api: 'openai-completions', vision: true, thinking: true, defaultEffort: 'high', family: 'other' },
]

const BY_ID = new Map(KNOWN.map(model => [model.id, model]))

function displayName(id: string): string {
  return id.split(/[-_/]/u).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

/** Return the documented catalog entry for an exact model id. */
export function knownModel(id: string): OpenCodeGoKnownModel | undefined {
  return BY_ID.get(id)
}

/**
 * Infer the wire protocol from official docs, then prefix families for live-only ids.
 * Official mapping: grok/gpt/muse → Responses; MiniMax/Qwen → Messages; everything else → Completions.
 */
export function protocolForModel(id: string): OpenCodeGoApi {
  const known = BY_ID.get(id)
  if (known !== undefined) return known.api
  const key = id.toLowerCase()
  if (key.startsWith('grok-') || key.startsWith('gpt-') || key.startsWith('muse-')) return 'openai-responses'
  if (key.startsWith('minimax-') || key.startsWith('qwen')) return 'anthropic-messages'
  return 'openai-completions'
}

/** Family used only by the picker overlay. */
export function familyForModel(id: string): OpenCodeGoFamily {
  const known = BY_ID.get(id)
  if (known !== undefined) return known.family
  const key = id.toLowerCase()
  if (key.startsWith('grok-')) return 'grok'
  if (key.startsWith('gpt-')) return 'gpt'
  if (key.startsWith('glm-')) return 'glm'
  if (key.startsWith('kimi-')) return 'kimi'
  if (key.startsWith('qwen')) return 'qwen'
  if (key.startsWith('deepseek-')) return 'deepseek'
  if (key.startsWith('minimax-')) return 'minimax'
  if (key.startsWith('mimo-')) return 'mimo'
  if (key === 'hy3' || key.startsWith('hy3-')) return 'hy3'
  if (key.startsWith('longcat-')) return 'longcat'
  if (key.startsWith('muse-')) return 'muse'
  return 'other'
}

export type OpenCodeGoListedModel = {
  name?: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  vision?: boolean
  thinking?: boolean
  defaultEffort?: string
  thinkingEfforts?: string[]
}

/** Merge live listing, models.dev, then the local snapshot. Do not invent a window. */
export function enrichModel(
  id: string,
  listed: OpenCodeGoListedModel,
  overlay?: OpenCodeGoListedModel,
): OpenCodeGoCatalogModelConfig {
  const known = BY_ID.get(id)
  const contextWindow = listed.contextWindow ?? overlay?.contextWindow ?? known?.contextWindow
  const maxTokens = listed.maxTokens ?? overlay?.maxTokens ?? known?.maxTokens
  const name = listed.name ?? overlay?.name ?? known?.name ?? displayName(id)
  const description = listed.description ?? overlay?.description
  const vision = listed.vision
    ?? overlay?.vision
    ?? (known?.vision === true || id.toLowerCase().includes('vision') || id.toLowerCase().includes('omni'))
  const thinking = listed.thinking ?? overlay?.thinking ?? known?.thinking === true
  const defaultEffort = listed.defaultEffort ?? overlay?.defaultEffort ?? known?.defaultEffort
  const thinkingEfforts = listed.thinkingEfforts ?? overlay?.thinkingEfforts
  return {
    id,
    name,
    ...(description === undefined || description === name ? {} : { description }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    vision,
    thinking,
    ...(defaultEffort === undefined || thinking !== true ? {} : { defaultEffort }),
    ...(thinking !== true || thinkingEfforts === undefined || thinkingEfforts.length === 0 ? {} : { thinkingEfforts }),
    api: protocolForModel(id),
    tools: true,
  }
}
