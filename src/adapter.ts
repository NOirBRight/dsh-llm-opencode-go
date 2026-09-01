/**
 * OpenCode Go chat adapter. The public route stays opencode-go, while the
 * wire implementation is delegated to pi-ai. Completions, Responses, and
 * Messages are selected per model. Discovery and usage stay native Host calls.
 */

import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmImageRequestPricing,
  LlmModelInfo,
  PreparedAdapterCall,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  ResolvedRetryPolicy,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { discoverModels } from './discovery.ts'
import {
  OPENCODE_GO_DEFAULT_CONTEXT_WINDOW,
  OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  OPENCODE_GO_PROVIDER,
} from './client-contract.ts'
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts'
import { createOpenCodeGoPiAiProfile } from './pi-ai-profile.ts'
import { createOpenCodeGoPiAiAuth } from './pi-ai-auth.ts'
import { applyOpenCodeGoReasoningMetadata } from './reasoning.ts'
import type { WireError } from './types.ts'

export type OpenCodeGoCatalogModel = OpenCodeGoCatalogModelConfig

/** Validated connection facts for one operation. */
export interface OpenCodeGoConnectionOptions {
  /** Go API base, including /zen/go/v1. */
  baseURL: string
  /** Credential reference of this same resolution, resolved per request. */
  apiKeyEnv: CredentialRef
  /** Models exposed to discovery consumers and accepted for chat requests. */
  models: readonly OpenCodeGoCatalogModel[]
  /** Positive context capacity used when the selected model has no exact value. */
  defaultContextWindow: number
  /** Default per-request output cap; explicit request values win. */
  maxTokens: number | undefined
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs: number
  /** Provider-owned model-request retry policy, already resolved. */
  retryPolicy: ResolvedRetryPolicy
}

/** Constructor options for OpenCodeGoAdapter. */
export interface OpenCodeGoAdapterOptions {
  options: () => OpenCodeGoConnectionOptions
  resolveApiKey: (connection: OpenCodeGoConnectionOptions) => Promise<string>
  resolveAttachments?: () => AttachmentStore | undefined
}

export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS
export const DEFAULT_CONTEXT_WINDOW = OPENCODE_GO_DEFAULT_CONTEXT_WINDOW

/** Map an HTTP status to a stable LlmError code for source-compatible callers. */
export function httpErrorCode(status: number, error?: WireError): string {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400) return 'INVALID_REQUEST'
  if (status >= 500) return 'SERVER'
  void error
  return 'HTTP_' + status
}

/** Classify documented transient OpenCode Go failures that can arrive without an HTTP status. */
export function classifyOpenCodeGoTransientError(chunk: StreamChunk): StreamChunk {
  if (chunk.type !== 'finish' || chunk.reason.kind !== 'error' || chunk.reason.failure.code !== 'PI_AI_ERROR') {
    return chunk
  }
  const message = chunk.reason.failure.message
  const code = /usage limit|quota|rate.?limit/iu.test(message)
    ? 'RATE_LIMIT'
    : /subscription required|unauthorized/iu.test(message)
      ? 'AUTH'
      : /overloaded|temporarily unavailable|cannot be reached/iu.test(message)
        ? 'SERVER'
        : undefined
  if (code === undefined) return chunk
  return {
    ...chunk,
    reason: { ...chunk.reason, failure: { ...chunk.reason.failure, code } },
  }
}

const SANDBOX_MODE_RANK: Record<string, number> = {
  'read-only': 0,
  'workspace-write': 1,
  'danger-full-access': 2,
}

/**
 * Remove sandbox escalation choices that cannot be strictly wider than the
 * current DSH policy. Core still validates every retained request; this only
 * prevents the model from selecting an impossible optional enum value.
 * Scans both options.system and options.messages context-injection text.
 */
export function narrowOpenCodeGoEscalationSchemas(options: GenerateOptions): GenerateOptions {
  const mode = sandboxModeOf(options)
  const currentRank = mode === undefined ? undefined : SANDBOX_MODE_RANK[mode]
  if (currentRank === undefined || options.tools === undefined) return options
  let changed = false
  const tools = options.tools.map((tool) => {
    const parameters = tool.parameters
    const properties = isRecord(parameters.properties) ? parameters.properties : undefined
    const permission = properties === undefined || !isRecord(properties.sandbox_permissions)
      ? undefined
      : properties.sandbox_permissions
    if (permission === undefined || !Array.isArray(permission.enum)) return tool
    const wider = permission.enum.filter((candidate): candidate is string => {
      return typeof candidate === 'string' && (SANDBOX_MODE_RANK[candidate] ?? -1) > currentRank
    })
    if (wider.length === permission.enum.length) return tool
    changed = true
    const nextProperties = { ...properties }
    if (wider.length === 0) {
      delete nextProperties.sandbox_permissions
      delete nextProperties.justification
    } else {
      nextProperties.sandbox_permissions = { ...permission, enum: wider }
    }
    const required = Array.isArray(parameters.required)
      ? parameters.required.filter(name => name !== 'sandbox_permissions' && name !== 'justification')
      : undefined
    return {
      ...tool,
      parameters: {
        ...parameters,
        properties: nextProperties,
        ...(required === undefined ? {} : { required }),
      },
    }
  })
  return changed ? { ...options, tools } : options
}

function sandboxModeOf(options: GenerateOptions): string | undefined {
  for (let index = options.messages.length - 1; index >= 0; index -= 1) {
    const message = options.messages[index]
    if (!isRecord(message)) continue
    const found = sandboxModeIn((message as any).content)
    if (found !== undefined) return found
  }
  return sandboxModeIn(options.system)
}

function sandboxModeIn(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return /Current DSH file policy:\s*(read-only|workspace-write|danger-full-access)\./u.exec(value)?.[1]
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = sandboxModeIn(item)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  return sandboxModeIn((value as any).text) ?? sandboxModeIn((value as any).content)
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The OpenCode Go chat adapter backed by a mixed-API pi-ai profile. */
export class OpenCodeGoAdapter extends LlmAdapter {
  private readonly auth = createOpenCodeGoPiAiAuth()
  private snapshot: { options: OpenCodeGoConnectionOptions, adapter: PiAiAdapter } | undefined

  constructor(private readonly config: OpenCodeGoAdapterOptions) {
    super()
  }

  private current(): PiAiAdapter {
    const options = this.config.options()
    if (this.snapshot?.options === options) return this.snapshot.adapter
    const profile = createOpenCodeGoPiAiProfile(options)
    const profiles = new Map<string, ResolvedPiAiProviderProfile>([[OPENCODE_GO_PROVIDER, profile]])
    const adapter = new PiAiAdapter({
      profiles: () => profiles,
      resolveApiKey: () => this.config.resolveApiKey(options),
      auth: this.auth,
      ...(this.config.resolveAttachments === undefined ? {} : { resolveAttachments: this.config.resolveAttachments }),
    })
    this.snapshot = { options, adapter }
    return adapter
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return this.current().providerInfo(provider)
  }

  override providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return this.current().providerRetryPolicy(provider)
  }

  /**
   * OpenCode Go does not publish provider-owned image-request pricing.
   * @param _provider - provider route.
   * @param _model - exact model id.
   * @returns undefined so the Host uses its neutral image estimate.
   */
  override imageRequestPricing(_provider: string, _model: string): LlmImageRequestPricing | undefined {
    return undefined
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.current().listModels(provider)
  }

  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const info = await this.current().resolveModel(provider, model, signal)
    const catalog = this.config.options().models.find(entry => entry.id === model)
    return applyOpenCodeGoReasoningMetadata(info, model, catalog?.defaultEffort)
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    for await (const chunk of this.current().stream(narrowOpenCodeGoEscalationSchemas(options))) {
      yield classifyOpenCodeGoTransientError(chunk)
    }
  }

  override async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> {
    const delegate = this.current()
    const inner = await delegate.prepareCall(provider, model, signal)
    const catalog = this.config.options().models.find(entry => entry.id === model)
    return {
      model: applyOpenCodeGoReasoningMetadata(inner.model, model, catalog?.defaultEffort),
      stream: async function* (options: GenerateOptions) {
        for await (const chunk of inner.stream(narrowOpenCodeGoEscalationSchemas(options))) {
          yield classifyOpenCodeGoTransientError(chunk)
        }
      },
    }
  }
}

export { discoverModels }