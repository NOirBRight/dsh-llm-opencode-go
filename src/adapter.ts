/**
 * OpenCode Go chat adapter. The public route stays opencode-go, while the
 * wire implementation is delegated to pi-ai. Completions, Responses, and
 * Messages are selected per model. Discovery and usage stay native Host calls.
 */

import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  ResolvedRetryPolicy,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
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
  resolveApiKey: () => Promise<string>
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
      resolveApiKey: () => this.config.resolveApiKey(),
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

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.current().listModels(provider)
  }

  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const info = await this.current().resolveModel(provider, model, signal)
    const catalog = this.config.options().models.find(entry => entry.id === model)
    return applyOpenCodeGoReasoningMetadata(info, model, catalog?.defaultEffort)
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    for await (const chunk of this.current().stream(options)) {
      yield classifyOpenCodeGoTransientError(chunk)
    }
  }

  override async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const delegate = this.current()
    const inner = typeof (delegate as { prepareCall?: unknown }).prepareCall === 'function'
      ? await (delegate as unknown as {
        prepareCall: (provider: string, model: string, signal?: AbortSignal) => Promise<{
          model: LlmResolvedModelInfo
          stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
        }>
      }).prepareCall(provider, model, signal)
      : {
        model: await this.resolveModel(provider, model, signal),
        stream: (options: GenerateOptions) => delegate.stream(options),
      }
    return {
      model: inner.model,
      stream: async function* (options: GenerateOptions) {
        for await (const chunk of inner.stream(options) as AsyncIterable<StreamChunk>) {
          yield classifyOpenCodeGoTransientError(chunk)
        }
      },
    }
  }
}

export { discoverModels }
