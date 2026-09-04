/**
 * Register the opencode-go route with chat delegated to pi-ai. Completions,
 * Responses, and Messages are selected per model. Discovery and usage stay
 * native Host RPCs; keys never cross the browser.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import { assertUsableApiKey, LlmError, resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { deepEqualJson } from '@deepseek-ai/dsh-util-values'
import type { SettingsPathOp } from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  OpenCodeGoAdapter,
} from './adapter.ts'
import type { OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts'
import { PUBLIC_BASE_URL, discoverModels } from './discovery.ts'
import { OPENCODE_GO_USAGE_UNSUPPORTED, readOpenCodeGoUsage } from './usage.ts'
import {
  decodeOpenCodeGoCredentialSetRequest,
  decodeOpenCodeGoDiscoveryRequest,
  decodeOpenCodeGoSaveRequest,
  decodeOpenCodeGoSettings,
  DEFAULT_API_KEY_ENV,
  OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
  OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_PROVIDER,
  OPENCODE_GO_RPC_CHANNEL,
  OPENCODE_GO_SAVE_ENDPOINT,
  OPENCODE_GO_SETTINGS_READ_ENDPOINT,
  OPENCODE_GO_SETTINGS_NAMESPACE,
  OPENCODE_GO_USAGE_ENDPOINT,
} from './client-contract.ts'

export {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  OpenCodeGoAdapter,
} from './adapter.ts'
export type { OpenCodeGoAdapterOptions, OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts'
export { PUBLIC_BASE_URL, discoverModels, parseOpenCodeGoModels } from './discovery.ts'
export { protocolForModel, enrichModel, familyForModel, knownModel } from './catalog.ts'
export {
  DEFAULT_USAGE_REQUEST_TIMEOUT_MS,
  OPENCODE_GO_USAGE_FAILED,
  OPENCODE_GO_USAGE_UNSUPPORTED,
  parseOpenCodeGoUsage,
  readOpenCodeGoUsage,
} from './usage.ts'
export type { OpenCodeGoUsageRequest } from './usage.ts'
export {
  DEFAULT_API_KEY_ENV,
  OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
  OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_PROVIDER,
  OPENCODE_GO_PUBLIC_BASE_URL,
  OPENCODE_GO_RPC_CHANNEL,
  OPENCODE_GO_SAVE_ENDPOINT,
  OPENCODE_GO_SETTINGS_READ_ENDPOINT,
  OPENCODE_GO_SETTINGS_NAMESPACE,
  OPENCODE_GO_USAGE_ENDPOINT,
  decodeOpenCodeGoCatalogModel,
  decodeOpenCodeGoCredentialSetRequest,
  decodeOpenCodeGoDiscoveryRequest,
  decodeOpenCodeGoDiscoveryResult,
  decodeOpenCodeGoSettingsReadResult,
  decodeOpenCodeGoSaveRequest,
  decodeOpenCodeGoSaveResult,
  decodeOpenCodeGoSettings,
  decodeOpenCodeGoUsageReply,
} from './client-contract.ts'
export type {
  OpenCodeGoApi,
  OpenCodeGoCatalogModelConfig,
  OpenCodeGoDiscoveryRequest,
  OpenCodeGoDiscoveryResult,
  OpenCodeGoSaveRequest,
  OpenCodeGoSaveResult,
  OpenCodeGoSettingsView,
  OpenCodeGoUsageModelCount,
  OpenCodeGoUsageReply,
  OpenCodeGoUsageView,
  OpenCodeGoUsageWindow,
} from './client-contract.ts'
export { createOpenCodeGoPiAiProfile } from './pi-ai-profile.ts'
export type * from './types.ts'

export const name = 'llm-opencode-go'
export const inject = ['llm']

const DEFAULT_MAX_RETRIES = 3
const NS = OPENCODE_GO_SETTINGS_NAMESPACE

export interface Config {
  apiKeyEnv?: string
  baseURL?: string
  models?: OpenCodeGoCatalogModel[]
  maxTokens?: number
  defaultContextWindow?: number
  streamIdleTimeoutMs?: number
  retryPolicy?: RetryPolicyConfig
}

const catalogModel: z<OpenCodeGoCatalogModel> = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  vision: z.boolean(),
  thinking: z.boolean(),
  defaultEffort: z.string(),
  thinkingEfforts: z.array(z.string()),
  api: z.union(['openai-completions', 'openai-responses', 'anthropic-messages']),
  tools: z.boolean(),
})

export const Config: z<Config> = z.object({
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string().default(PUBLIC_BASE_URL),
  models: z.array(catalogModel).default([]),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
})

export type ResolvedOpenCodeGoOptions = OpenCodeGoConnectionOptions

function resolveModels(models: readonly OpenCodeGoCatalogModel[] | undefined): OpenCodeGoCatalogModel[] {
  const seen = new Set<string>()
  return (models ?? []).map((model) => {
    if (model.id.length === 0) throw new Error('llm-opencode-go: catalog model ids must be non-empty')
    if (model.name !== undefined && model.name.length === 0) {
      throw new Error('llm-opencode-go: catalog model "' + model.id + '" has an empty name')
    }
    if (model.contextWindow !== undefined && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) {
      throw new Error('llm-opencode-go: catalog model "' + model.id + '" contextWindow must be a positive integer')
    }
    if (model.maxTokens !== undefined && (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)) {
      throw new Error('llm-opencode-go: catalog model "' + model.id + '" maxTokens must be a positive integer')
    }
    if (seen.has(model.id)) throw new Error('llm-opencode-go: duplicate catalog model id ' + model.id)
    seen.add(model.id)
    return {
      id: model.id,
      ...(model.name === undefined ? {} : { name: model.name }),
      ...(model.description === undefined ? {} : { description: model.description }),
      ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
      ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
      ...(model.vision === undefined ? {} : { vision: model.vision }),
      ...(model.thinking === undefined ? {} : { thinking: model.thinking }),
      ...(model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort }),
      ...(model.thinkingEfforts === undefined ? {} : { thinkingEfforts: model.thinkingEfforts }),
      ...(model.api === undefined ? {} : { api: model.api }),
      ...(model.tools === undefined ? {} : { tools: model.tools }),
    }
  })
}

function validHTTPURL(value: string, field: string): string {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error('llm-opencode-go: ' + field + ' must be an HTTP or HTTPS URL') }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('llm-opencode-go: ' + field + ' must be an HTTP or HTTPS URL')
  }
  return value.replace(/\/+$/u, '')
}

export function resolveAdapterOptions(config: Config): OpenCodeGoConnectionOptions {
  const defaultContextWindow = config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isSafeInteger(defaultContextWindow) || defaultContextWindow <= 0) {
    throw new Error('llm-opencode-go: defaultContextWindow must be a positive integer')
  }
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error('llm-opencode-go: streamIdleTimeoutMs is invalid')
  }
  if (config.maxTokens !== undefined && (!Number.isSafeInteger(config.maxTokens) || config.maxTokens <= 0)) {
    throw new Error('llm-opencode-go: maxTokens must be a positive integer')
  }
  return {
    apiKeyEnv: credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV),
    baseURL: validHTTPURL(config.baseURL ?? PUBLIC_BASE_URL, 'baseURL'),
    models: resolveModels(config.models),
    defaultContextWindow,
    maxTokens: config.maxTokens,
    streamIdleTimeoutMs,
    retryPolicy: resolveRetryPolicy(config.retryPolicy ?? { mode: 'normal', maxRetries: DEFAULT_MAX_RETRIES }, 'llm-opencode-go: retryPolicy'),
  }
}

function discoveryFailure(message: string, baseURL?: string) {
  return {
    ok: false as const,
    error: {
      code: 'model-discovery-failed' as const,
      message,
      details: { settingsNs: OPENCODE_GO_SETTINGS_NAMESPACE, ...(baseURL === undefined ? {} : { baseURL }) },
    },
  }
}

function settingsFailure(message: string) {
  return { ok: false as const, error: { code: 'internal' as const, message, details: {} } }
}

function usageFailure(error: unknown) {
  if (error instanceof LlmError && error.code === OPENCODE_GO_USAGE_UNSUPPORTED) {
    return { ok: true as const, value: { status: 'unsupported' as const } }
  }
  const message = error instanceof LlmError && error.message.length > 0 ? error.message : 'OpenCode Go usage read failed'
  return settingsFailure(message)
}

export function apply(ctx: Context, config: Config): void {
  if (Object.hasOwn(config, 'remoteManagement')) {
    throw new Error('llm-opencode-go: remoteManagement is unsupported by the Alpha.4 Host RPC; remove it from the plugin config')
  }
  let current: () => Config = () => config
  let lastRaw: Config | undefined
  let lastGood: OpenCodeGoConnectionOptions | undefined
  const options = (): OpenCodeGoConnectionOptions => {
    const raw = current()
    if (raw === lastRaw && lastGood !== undefined) return lastGood
    try {
      const next = resolveAdapterOptions(raw)
      lastRaw = raw
      lastGood = next
      return next
    } catch (error) {
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('llm-opencode-go: keeping the last good configuration after an invalid settings section')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  const resolveApiKey = async (connection: OpenCodeGoConnectionOptions): Promise<string> => {
    const ref = connection.apiKeyEnv
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined) return assertUsableApiKey(hit.value, 'llm-opencode-go', ref)
    } else {
      const ambient = launchEnvironmentOf(ctx).get(ref)
      if (ambient !== undefined && ambient.value.length > 0) {
        return assertUsableApiKey(ambient.value, 'llm-opencode-go', ref)
      }
    }
    throw new LlmError(
      'llm-opencode-go: no API key for provider route "' + OPENCODE_GO_PROVIDER + '"; store ' + ref
      + ' through the credentials service, or export ' + ref + ' in the launching environment',
      'MISSING_CREDENTIAL',
    )
  }

  const adapter = new OpenCodeGoAdapter({
    options,
    resolveApiKey,
    resolveAttachments: () => ctx.get('attachments'),
  })
  // opencode-go is already a pi-ai catalog route declared by llm-pi-ai.
  // Claiming it again as a configurable provider fails the whole plugin
  // (DUPLICATE_DIRECTORY). Chat takeover is the adapter registration below.
  const registration = ctx.llm.registerAdapter([OPENCODE_GO_PROVIDER], adapter)
  let registeredPolicy = options().retryPolicy
  const ensureRegistrationFacts = (): void => {
    const policy = options().retryPolicy
    if (deepEqualJson(policy, registeredPolicy)) return
    registration.replace([OPENCODE_GO_PROVIDER])
    registeredPolicy = policy
  }

  const storedApiKey = async (): Promise<string | undefined> => {
    const ref = options().apiKeyEnv
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) return (await credentials.resolve(ref))?.value
    return launchEnvironmentOf(ctx).get(ref)?.value
  }
  const credentialStatus = async (): Promise<{ configured: boolean, writable: boolean }> => {
    const credentials = ctx.get('credentials')
    if (credentials === undefined) return { configured: false, writable: false }
    const info = await credentials.describe(options().apiKeyEnv)
    return { configured: info.configured, writable: info.writable }
  }

  // Host Models-page discovery may include a draft apiKey on LlmModelDiscoveryRequest.
  // The plugin browser RPC never forwards secrets; it only uses storedApiKey.
  ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels(request, storedApiKey, fetch, signal))

  ctx.effect(() => {
    const connectionFiber = ctx.inject(['connection'], (connectionCtx) => {
      connectionCtx.effect(
        () => connectionCtx.connection.rpc.handle(
          OPENCODE_GO_RPC_CHANNEL,
          async (endpoint, payload, signal) => {
            if (endpoint === OPENCODE_GO_SETTINGS_READ_ENDPOINT) {
              const descriptor = ctx.get('settings')?.describe().find(item => item.ns === NS)
              const settings = decodeOpenCodeGoSettings(descriptor?.value)
              if (descriptor === undefined || settings === undefined) return settingsFailure('OpenCode Go settings are unavailable')
              return { ok: true as const, value: { settings, revision: descriptor.revision, credential: await credentialStatus() } }
            }
            if (endpoint === OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT) {
              return { ok: true as const, value: await credentialStatus() }
            }
            if (endpoint === OPENCODE_GO_CREDENTIAL_SET_ENDPOINT) {
              const request = decodeOpenCodeGoCredentialSetRequest(payload)
              if (request === undefined) return settingsFailure('invalid OpenCode Go credential request')
              const credentials = ctx.get('credentials')
              if (credentials === undefined) return settingsFailure('OpenCode Go credentials are unavailable')
              await credentials.set(options().apiKeyEnv, request.apiKey)
              return { ok: true as const, value: await credentialStatus() }
            }
            if (endpoint === OPENCODE_GO_DISCOVER_ENDPOINT) {
              const request = decodeOpenCodeGoDiscoveryRequest(payload)
              if (request === undefined) return discoveryFailure('invalid OpenCode Go discovery request')
              try {
                const models = await discoverModels(
                  { ...(request.baseURL === undefined ? {} : { baseURL: request.baseURL }) },
                  storedApiKey,
                  fetch,
                  signal,
                )
                return { ok: true as const, value: { models } }
              } catch (error: unknown) {
                const message = error instanceof LlmError ? error.message : 'OpenCode Go model discovery failed'
                return discoveryFailure(message, request.baseURL)
              }
            }
            if (endpoint === OPENCODE_GO_SAVE_ENDPOINT) {
              const request = decodeOpenCodeGoSaveRequest(payload)
              if (request === undefined) return settingsFailure('invalid OpenCode Go settings request')
              const settings = ctx.get('settings')
              if (settings === undefined) return settingsFailure('OpenCode Go settings are unavailable')
              try {
                const before = settings.describe().find(descriptor => descriptor.ns === NS)
                if (before === undefined) return settingsFailure('OpenCode Go settings are unavailable')
                const currentSettings = decodeOpenCodeGoSettings(before.value)
                if (currentSettings === undefined) return settingsFailure('OpenCode Go settings are invalid')
                const ops: SettingsPathOp[] = []
                if (!deepEqualJson(currentSettings.baseURL, request.baseURL)) {
                  ops.push({ op: 'set', path: ['baseURL'], value: request.baseURL })
                }
                if (!deepEqualJson(currentSettings.models, request.models)) {
                  ops.push({ op: 'set', path: ['models'], value: request.models })
                }
                if (ops.length > 0) await settings.mutate(NS, ops, request.expectedRevision)
                const accepted = settings.describe().find(descriptor => descriptor.ns === NS)
                const acceptedSettings = decodeOpenCodeGoSettings(accepted?.value)
                if (accepted === undefined || acceptedSettings === undefined) {
                  return settingsFailure('OpenCode Go settings could not be reloaded')
                }
                return { ok: true as const, value: { settings: acceptedSettings, revision: accepted.revision } }
              } catch (error: unknown) {
                const message = error instanceof Error && error.message.length > 0 ? error.message : 'OpenCode Go settings save failed'
                return settingsFailure(message)
              }
            }
            if (endpoint === OPENCODE_GO_USAGE_ENDPOINT) {
              const request = decodeOpenCodeGoDiscoveryRequest(payload)
              if (request === undefined) return settingsFailure('invalid OpenCode Go usage request')
              try {
                const usage = await readOpenCodeGoUsage(
                  { ...(request.baseURL === undefined ? {} : { baseURL: request.baseURL }), signal },
                  storedApiKey,
                )
                return { ok: true as const, value: { status: 'ok' as const, usage } }
              } catch (error: unknown) {
                return usageFailure(error)
              }
            }
            return settingsFailure('unknown OpenCode Go endpoint: ' + endpoint)
          },
        ),
        'llm-opencode-go: RPC channel',
      )
    })
    return connectionFiber.dispose
  }, 'llm-opencode-go: connection RPC injection')
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (source) => { current = source },
      onChange: ensureRegistrationFacts,
    })
  })
}
