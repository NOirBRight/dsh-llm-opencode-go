/** Browser-safe constants and JSON decoders shared by the Host and client plugin faces. */

import { isJsonRecord } from './json-record.ts'

/** Settings namespace owned by the OpenCode Go plugin. */
export const OPENCODE_GO_SETTINGS_NAMESPACE = 'llm-opencode-go'
/** Provider route owned by the OpenCode Go plugin. */
export const OPENCODE_GO_PROVIDER = 'opencode-go'
/** Credential reference used when the settings section names none. */
export const DEFAULT_API_KEY_ENV = 'OPENCODE_API_KEY'
/** Public OpenCode Go API base URL. */
export const OPENCODE_GO_PUBLIC_BASE_URL = 'https://opencode.ai/zen/go/v1'
/** Default context capacity for models without documented or discovered metadata. */
export const OPENCODE_GO_DEFAULT_CONTEXT_WINDOW = 262_144
/** Default maximum idle interval while a stream read is outstanding. */
export const OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
/** Private Connection RPC channel used by this package's two runtime faces. */
export const OPENCODE_GO_RPC_CHANNEL = '/opencode-go'
/** Rich model-discovery endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
export const OPENCODE_GO_DISCOVER_ENDPOINT = 'models/discover'
/** Atomic settings-save endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
export const OPENCODE_GO_SAVE_ENDPOINT = 'settings/save'
/** Subscription usage-snapshot endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
export const OPENCODE_GO_USAGE_ENDPOINT = 'usage/read'

/** Wire protocol selected for one OpenCode Go model. */
export type OpenCodeGoApi = 'openai-completions' | 'openai-responses' | 'anthropic-messages'

/** One model stored in the plugin's advisory catalog. */
export interface OpenCodeGoCatalogModelConfig {
  /** Wire model id accepted by the configured endpoint. */
  id: string
  /** Selector label; omission uses {@link id}. */
  name?: string
  /** Optional selector detail for similar model variants. */
  description?: string
  /** Known combined request and response context capacity. */
  contextWindow?: number
  /** Per-request output cap for this model. */
  maxTokens?: number
  /** Whether the model accepts image input. */
  vision?: boolean
  /** Whether the model supports native thinking. */
  thinking?: boolean
  /** Chat-picker default when the conversation has not chosen a level. */
  defaultEffort?: string
  /** Optional explicit protocol override; omission uses the documented mapping. */
  api?: OpenCodeGoApi
  /** Legacy capability flag. Ignored at runtime; still decoded. */
  tools?: boolean
}

/** Settings fields presented by the package's Web configuration card. */
export interface OpenCodeGoSettingsView {
  /** Credential reference resolved by the Host. */
  apiKeyEnv: string
  /** Go API base URL ending in /zen/go/v1. */
  baseURL: string
  /** Advisory model catalog. */
  models: OpenCodeGoCatalogModelConfig[]
  /** Optional provider-wide output cap. */
  maxTokens?: number
  /** Context fallback for models without an exact capacity. */
  defaultContextWindow: number
  /** Stream idle timeout in milliseconds. */
  streamIdleTimeoutMs: number
}

/** Draft endpoint sent to Host discovery/usage. Secrets stay in the credentials API. */
export interface OpenCodeGoDiscoveryRequest {
  /** Unsaved API base URL. */
  baseURL?: string
}

/** Rich model-discovery result returned to the package's own client card. */
export interface OpenCodeGoDiscoveryResult {
  /** Models in provider order, including documented protocol and capability flags. */
  models: OpenCodeGoCatalogModelConfig[]
}

/** Atomic editable-settings payload sent by the package's browser face. */
export interface OpenCodeGoSaveRequest {
  /** API URL currently shown by the editor. */
  baseURL: string
  /** Complete advisory catalog currently shown by the editor. */
  models: OpenCodeGoCatalogModelConfig[]
  /** Settings descriptor revision from which the editor began. */
  expectedRevision: number
  /** Typed key stored by the Host credentials service; omitted when unchanged. */
  apiKey?: string
}

/** Accepted settings snapshot returned after one atomic Host mutation. */
export interface OpenCodeGoSaveResult {
  /** Resolved settings after the mutation commits. */
  settings: OpenCodeGoSettingsView
  /** New descriptor revision accepted by the Host. */
  revision: number
}

/** One model's accounted requests inside a usage window. */
export interface OpenCodeGoUsageModelCount {
  /** Provider-side model label. */
  name: string
  /** Requests accounted to this model in the window. */
  requestCount: number
}

/** One metered quota window. */
export interface OpenCodeGoUsageWindow {
  /** Consumed fraction of the window; 0.12 renders as "12.0%". */
  usage: number
  /** Per-model request counts in the window, when the endpoint reports any. */
  models: OpenCodeGoUsageModelCount[]
  /** ISO-8601 instant when this window resets, when the endpoint reports one. */
  resetsAt?: string
}

/** Secret-free subscription usage snapshot read for the configuration card. */
export interface OpenCodeGoUsageView {
  /** ISO-8601 time the Host read the snapshot. */
  fetchedAt: string
  /** Rolling 5-hour window, when the endpoint reports one. */
  session?: OpenCodeGoUsageWindow
  /** Weekly window, when the endpoint reports one. */
  weekly?: OpenCodeGoUsageWindow
  /** Monthly window, when the endpoint reports one. */
  monthly?: OpenCodeGoUsageWindow
}

/** Usage answer crossing the plugin RPC. */
export type OpenCodeGoUsageReply =
  | { status: 'ok', usage: OpenCodeGoUsageView }
  | { status: 'unsupported' }

function optionalPositiveInteger(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
}

function isOpenCodeGoApi(value: unknown): value is OpenCodeGoApi {
  return value === 'openai-completions' || value === 'openai-responses' || value === 'anthropic-messages'
}

/** Narrow one model crossing the settings or plugin-RPC JSON boundary. */
export function decodeOpenCodeGoCatalogModel(value: unknown): OpenCodeGoCatalogModelConfig | undefined {
  if (!isJsonRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return undefined
  const name = value.name
  const description = value.description
  const contextWindow = value.contextWindow
  const maxTokens = value.maxTokens
  const vision = value.vision
  const thinking = value.thinking
  const defaultEffort = value.defaultEffort
  const tools = value.tools
  const protocol = value.api
  if (name !== undefined && typeof name !== 'string') return undefined
  if (description !== undefined && typeof description !== 'string') return undefined
  if (!optionalPositiveInteger(contextWindow) || !optionalPositiveInteger(maxTokens)) return undefined
  if (vision !== undefined && typeof vision !== 'boolean') return undefined
  if (thinking !== undefined && typeof thinking !== 'boolean') return undefined
  if (defaultEffort !== undefined && (typeof defaultEffort !== 'string' || defaultEffort.length === 0)) return undefined
  if (tools !== undefined && typeof tools !== 'boolean') return undefined
  if (protocol !== undefined && !isOpenCodeGoApi(protocol)) return undefined
  return {
    id: value.id,
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(vision === undefined ? {} : { vision }),
    ...(thinking === undefined ? {} : { thinking }),
    ...(defaultEffort === undefined ? {} : { defaultEffort }),
    ...(protocol === undefined ? {} : { api: protocol }),
    ...(tools === undefined ? {} : { tools }),
  }
}

/** Narrow the redacted, schema-resolved settings section before it enters React state. */
export function decodeOpenCodeGoSettings(value: unknown): OpenCodeGoSettingsView | undefined {
  if (!isJsonRecord(value)) return undefined
  const apiKeyEnv = value.apiKeyEnv
  const baseURL = value.baseURL
  const models = value.models
  const maxTokens = value.maxTokens
  const defaultContextWindow = value.defaultContextWindow
  const streamIdleTimeoutMs = value.streamIdleTimeoutMs
  if (typeof apiKeyEnv !== 'string' || apiKeyEnv.length === 0) return undefined
  if (typeof baseURL !== 'string' || baseURL.length === 0) return undefined
  if (!Array.isArray(models)) return undefined
  if (!optionalPositiveInteger(maxTokens)) return undefined
  if (!optionalPositiveInteger(defaultContextWindow) || defaultContextWindow === undefined) return undefined
  if (typeof streamIdleTimeoutMs !== 'number' || !Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0) {
    return undefined
  }
  const decodedModels: OpenCodeGoCatalogModelConfig[] = []
  for (const model of models) {
    const decoded = decodeOpenCodeGoCatalogModel(model)
    if (decoded === undefined) return undefined
    decodedModels.push(decoded)
  }
  return {
    apiKeyEnv,
    baseURL,
    models: decodedModels,
    ...(maxTokens === undefined ? {} : { maxTokens }),
    defaultContextWindow,
    streamIdleTimeoutMs,
  }
}

/** Narrow the rich discovery request received by the Host plugin. */
export function decodeOpenCodeGoDiscoveryRequest(value: unknown): OpenCodeGoDiscoveryRequest | undefined {
  if (!isJsonRecord(value)) return undefined
  if (value.baseURL !== undefined && (typeof value.baseURL !== 'string' || value.baseURL.length === 0)) return undefined
  return {
    ...(value.baseURL === undefined ? {} : { baseURL: value.baseURL }),
  }
}

/** Narrow the Host discovery reply before the picker renders it. */
export function decodeOpenCodeGoDiscoveryResult(value: unknown): OpenCodeGoDiscoveryResult | undefined {
  if (!isJsonRecord(value) || !Array.isArray(value.models)) return undefined
  const models: OpenCodeGoCatalogModelConfig[] = []
  for (const item of value.models) {
    const model = decodeOpenCodeGoCatalogModel(item)
    if (model === undefined) return undefined
    models.push(model)
  }
  return { models }
}

/** Narrow the atomic save request. */
export function decodeOpenCodeGoSaveRequest(value: unknown): OpenCodeGoSaveRequest | undefined {
  if (!isJsonRecord(value)) return undefined
  const expectedRevision = value.expectedRevision
  if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 0) return undefined
  if (typeof value.baseURL !== 'string' || value.baseURL.length === 0 || !Array.isArray(value.models)) return undefined
  const models: OpenCodeGoCatalogModelConfig[] = []
  for (const item of value.models) {
    const model = decodeOpenCodeGoCatalogModel(item)
    if (model === undefined) return undefined
    models.push(model)
  }
  if (value.apiKey !== undefined && (typeof value.apiKey !== 'string' || value.apiKey.length === 0)) return undefined
  return {
    baseURL: value.baseURL,
    models,
    expectedRevision: expectedRevision as number,
    ...(value.apiKey === undefined ? {} : { apiKey: value.apiKey }),
  }
}

/** Narrow the Host save reply. */
export function decodeOpenCodeGoSaveResult(value: unknown): OpenCodeGoSaveResult | undefined {
  if (!isJsonRecord(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) return undefined
  const settings = decodeOpenCodeGoSettings(value.settings)
  return settings === undefined ? undefined : { settings, revision: value.revision as number }
}

function decodeUsageWindow(value: unknown): OpenCodeGoUsageWindow | undefined {
  if (!isJsonRecord(value) || typeof value.usage !== 'number' || !Number.isFinite(value.usage) || value.usage < 0) return undefined
  const models: OpenCodeGoUsageModelCount[] = []
  if (value.models !== undefined) {
    if (!Array.isArray(value.models)) return undefined
    for (const entry of value.models) {
      if (!isJsonRecord(entry) || typeof entry.name !== 'string' || entry.name.length === 0) return undefined
      if (typeof entry.requestCount !== 'number' || !Number.isSafeInteger(entry.requestCount) || entry.requestCount < 0) return undefined
      models.push({ name: entry.name, requestCount: entry.requestCount })
    }
  }
  if (value.resetsAt !== undefined && typeof value.resetsAt !== 'string') return undefined
  return {
    usage: value.usage,
    models,
    ...(value.resetsAt === undefined ? {} : { resetsAt: value.resetsAt }),
  }
}

/** Decode the secret-free usage snapshot returned by the Host. */
export function decodeOpenCodeGoUsageView(value: unknown): OpenCodeGoUsageView | undefined {
  if (!isJsonRecord(value) || typeof value.fetchedAt !== 'string') return undefined
  const view: OpenCodeGoUsageView = { fetchedAt: value.fetchedAt }
  for (const key of ['session', 'weekly', 'monthly'] as const) {
    if (value[key] === undefined) continue
    const window = decodeUsageWindow(value[key])
    if (window === undefined) return undefined
    view[key] = window
  }
  return view
}

/** Decode the usage RPC success payload. */
export function decodeOpenCodeGoUsageReply(value: unknown): OpenCodeGoUsageReply | undefined {
  if (!isJsonRecord(value) || (value.status !== 'ok' && value.status !== 'unsupported')) return undefined
  if (value.status === 'unsupported') return { status: 'unsupported' }
  const usage = decodeOpenCodeGoUsageView(value.usage)
  return usage === undefined ? undefined : { status: 'ok', usage }
}
