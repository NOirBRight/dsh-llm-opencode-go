/**
 * Translate OpenCode Go connection facts into a mixed-API pi-ai profile.
 * One route, three wire protocols: model.api selects Completions, Responses, or Messages.
 */

import { createProvider } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import type { Api, Model, Provider } from '@earendil-works/pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { OPENCODE_GO_PROVIDER } from './client-contract.ts'
import type { OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts'
import { protocolForModel } from './catalog.ts'
import { openCodeGoThinkingLevelMap } from './reasoning.ts'

export const OPENCODE_GO_DEFAULT_MODEL_MAX_TOKENS = 32_768
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

type GoApi = 'openai-completions' | 'openai-responses' | 'anthropic-messages'

function toPiAiModel(
  model: OpenCodeGoCatalogModel,
  connection: OpenCodeGoConnectionOptions,
  baseUrl: string,
): Model<GoApi> {
  const api = model.api ?? protocolForModel(model.id)
  const levels = openCodeGoThinkingLevelMap(model)
  const shared = {
    id: model.id,
    name: model.name ?? model.id,
    provider: OPENCODE_GO_PROVIDER,
    baseUrl,
    reasoning: model.thinking === true,
    ...(levels === undefined ? {} : { thinkingLevelMap: levels }),
    input: (model.vision === true ? ['text', 'image'] : ['text']) as 'text'[] | ['text', 'image'],
    cost: NO_COST,
    contextWindow: model.contextWindow ?? connection.defaultContextWindow,
    maxTokens: model.maxTokens ?? OPENCODE_GO_DEFAULT_MODEL_MAX_TOKENS,
  }
  if (api === 'openai-responses') {
    return {
      ...shared,
      api: 'openai-responses',
      compat: {
        supportsDeveloperRole: false,
        supportsLongCacheRetention: false,
        supportsStrictMode: false,
        supportsOpenAIGrammarTools: false,
        supportsToolSearch: false,
        supportsExplicitPromptCacheMode: false,
      },
    }
  }
  if (api === 'anthropic-messages') {
    return {
      ...shared,
      api: 'anthropic-messages',
    }
  }
  return {
    ...shared,
    api: 'openai-completions',
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      supportsUsageInStreaming: true,
      maxTokensField: 'max_tokens',
      thinkingFormat: 'openai',
    },
  }
}

function goAuth(): Provider['auth'] {
  return {
    apiKey: {
      name: 'OpenCode Go API key',
      resolve: ({ credential }) => Promise.resolve({
        auth: credential?.key === undefined ? {} : { apiKey: credential.key },
        source: 'OpenCode Go',
      }),
    },
  }
}

/** Resolve the complete pi-ai profile for one OpenCode Go options snapshot. */
export function createOpenCodeGoPiAiProfile(
  connection: OpenCodeGoConnectionOptions,
): ResolvedPiAiProviderProfile {
  const baseURL = connection.baseURL.replace(/\/+$/u, '')
  const models = connection.models.map(model => toPiAiModel(model, connection, baseURL))
  const configuredMaxTokens = new Map<string, number>()
  if (connection.maxTokens !== undefined) {
    for (const model of connection.models) configuredMaxTokens.set(model.id, connection.maxTokens)
  }
  const piProvider = createProvider({
    id: OPENCODE_GO_PROVIDER,
    name: 'OpenCode Go',
    baseUrl: baseURL,
    auth: goAuth(),
    models,
    api: {
      'openai-completions': openAICompletionsApi(),
      'openai-responses': openAIResponsesApi(),
      'anthropic-messages': anthropicMessagesApi(),
    },
  })
  return {
    provider: OPENCODE_GO_PROVIDER,
    displayName: 'OpenCode Go',
    apiKeyEnv: connection.apiKeyEnv,
    baseURL,
    defaultContextWindow: connection.defaultContextWindow,
    defaultMaxTokens: OPENCODE_GO_DEFAULT_MODEL_MAX_TOKENS,
    defaultInput: ['text'],
    streamIdleTimeoutMs: connection.streamIdleTimeoutMs,
    maxRequestImageBytes: DEFAULT_MAX_REQUEST_IMAGE_BYTES,
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
    retryPolicy: connection.retryPolicy,
    piProvider,
    configuredMaxTokens,
  } as ResolvedPiAiProviderProfile
}

export type { Api }
