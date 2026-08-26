/** Browser half: OpenCode Go setup inside Plugin configuration. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  decodeOpenCodeGoDiscoveryResult,
  decodeOpenCodeGoSettings,
  decodeOpenCodeGoUsageReply,
  DEFAULT_API_KEY_ENV,
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_RPC_CHANNEL,
  OPENCODE_GO_SETTINGS_NAMESPACE,
  OPENCODE_GO_USAGE_ENDPOINT,
} from '../client-contract.ts'
import type { OpenCodeGoDiscoveryRequest, OpenCodeGoSettingsView } from '../client-contract.ts'
import { ensureProviderSection } from './provider-section.ts'
import { OpenCodeGoPluginCard } from './OpenCodeGoPluginCard.tsx'
import type { OpenCodeGoPluginCardFace } from './OpenCodeGoPluginCard.tsx'
import { OpenCodeGoModelPicker, OpenCodeGoModelPickerController } from './OpenCodeGoModelPicker.tsx'
import type { OpenCodeGoModelPickerFace } from './OpenCodeGoModelPicker.tsx'
import { en, zh } from './locales.ts'
import type { OpenCodeGoSettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OpenCode Go Plugin configuration copy. */
    'settings.opencode-go': OpenCodeGoSettingsKey
  }
}

/** Stable browser-plugin name. */
export const name = 'dsh-llm-opencode-go-client'
/** Client services required by the Plugin configuration contribution. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/** Register localized OpenCode Go configuration under Plugin configuration. */
export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.opencode-go'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-llm-opencode-go: Plugin configuration copy',
  )
  const t = ctx.locale.bind(localeNamespace) as OpenCodeGoPluginCardFace['t']
  const scope = ctx.settingsScope.bind<OpenCodeGoSettingsView>({
    namespace: OPENCODE_GO_SETTINGS_NAMESPACE,
    decode: decodeOpenCodeGoSettings,
  })
  const picker = new OpenCodeGoModelPickerController()
  // This dual-runtime package compiles Host and Client Context augmentations in
  // one project; the browser entry receives the client handle at runtime.
  const { api: connectionApi, rpc } = ctx.get('connection') as unknown as ConnectionHandle

  const describeCredential: OpenCodeGoPluginCardFace['describeCredential'] = async () => {
    const ref = scope.getSnapshot().value?.apiKeyEnv ?? DEFAULT_API_KEY_ENV
    const response = await connectionApi.credentials.describe({ refs: [ref] })
    if (!response.result.ok) throw new Error(response.result.error.message)
    const credential = response.result.value.credentials[ref]
    return {
      configured: credential?.configured ?? false,
      writable: credential?.writable ?? true,
    }
  }

  const withTimeout = async <T>(work: Promise<T>, ms: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        work,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => { reject(new Error(t('requestFailed'))) }, ms)
        }),
      ])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  const storeApiKey: OpenCodeGoPluginCardFace['storeApiKey'] = async (value) => {
    const ref = scope.getSnapshot().value?.apiKeyEnv ?? DEFAULT_API_KEY_ENV
    const response = await withTimeout(
      connectionApi.credentials.set({ ref, value }, AbortSignal.timeout(15_000)),
      15_000,
    )
    if (!response.result.ok) throw new Error(response.result.error.message)
  }

  const saveConfiguration: OpenCodeGoPluginCardFace['saveConfiguration'] = async (settings, apiKey) => {
    // A typed key is the common Save from this card. Writing unchanged
    // baseURL/models through settings.mutate can stall the whole Save.
    if (apiKey !== undefined) await storeApiKey(apiKey)
    const snapshot = scope.getSnapshot()
    if (snapshot.value === undefined || snapshot.revision === undefined) throw new Error(t('requestFailed'))
    const ops: { op: 'set', path: string[], value: unknown }[] = []
    if (snapshot.value.baseURL !== settings.baseURL) {
      ops.push({ op: 'set', path: ['baseURL'], value: settings.baseURL })
    }
    if (JSON.stringify(snapshot.value.models) !== JSON.stringify(settings.models)) {
      ops.push({ op: 'set', path: ['models'], value: settings.models })
    }
    if (ops.length === 0) return { settings: snapshot.value, revision: snapshot.revision }
    const response = await withTimeout(
      connectionApi.settings.mutate({
        ns: OPENCODE_GO_SETTINGS_NAMESPACE,
        ops,
        expectedRevision: snapshot.revision,
      }, AbortSignal.timeout(15_000)),
      15_000,
    )
    if (!response.result.ok) throw new Error(response.result.error.message)
    const decoded = decodeOpenCodeGoSettings(response.result.value.value)
    if (decoded === undefined) throw new Error(t('requestFailed'))
    return { settings: decoded, revision: response.result.value.revision }
  }

  const callPlugin = async (endpoint: string, payload: unknown) => {
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, 20_000)
    try {
      return await rpc.call(OPENCODE_GO_RPC_CHANNEL, endpoint, payload, controller.signal)
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new Error(t('requestFailed'))
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  const fetchUsage: OpenCodeGoPluginCardFace['fetchUsage'] = async (request: OpenCodeGoDiscoveryRequest) => {
    const result = await callPlugin(OPENCODE_GO_USAGE_ENDPOINT, request)
    if (!result.ok) {
      // A Host started before this package's usage endpoint exists answers
      // with its unknown-endpoint error; the card asks for a restart instead
      // of surfacing that as a read failure.
      if (result.error.message.startsWith('unknown OpenCode Go endpoint')) {
        return { kind: 'needs-restart' as const }
      }
      throw new Error(result.error.message)
    }
    const reply = decodeOpenCodeGoUsageReply(result.value)
    if (reply === undefined) throw new Error('OpenCode Go returned an invalid usage snapshot')
    return reply.status === 'ok'
      ? { kind: 'ok' as const, usage: reply.usage }
      : { kind: 'unsupported' as const }
  }

  const discoverModels: OpenCodeGoPluginCardFace['discoverModels'] = async (request: OpenCodeGoDiscoveryRequest) => {
    const result = await callPlugin(OPENCODE_GO_DISCOVER_ENDPOINT, request)
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeOpenCodeGoDiscoveryResult(result.value)
    if (decoded === undefined) throw new Error('OpenCode Go returned an invalid model catalog')
    return decoded.models
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'opencode-go-model-picker',
    order: 100,
    inject: (): OpenCodeGoModelPickerFace => ({
      t,
      hooks: { openCodeGoModelPicker: picker },
      closePicker: picker.close,
      togglePickerModel: picker.toggle,
      adoptPickerModels: picker.adopt,
    }),
  }, OpenCodeGoModelPicker))

  ensureProviderSection(ctx)
  ctx.slots.inject('settings.provider.item', () => ctx.slots.register({
    name: 'settings.provider.item',
    key: OPENCODE_GO_SETTINGS_NAMESPACE,
    locale: localeNamespace,
    inject: (): OpenCodeGoPluginCardFace => ({
      t,
      hooks: { openCodeGoSettings: scope },
      describeCredential,
      storeApiKey,
      saveConfiguration,
      discoverModels,
      fetchUsage,
      beginModelPicker: (initiallyPicked, onAdopt) => { picker.begin(onAdopt, initiallyPicked) },
      completeModelPicker: candidates => { picker.complete(candidates) },
      failModelPicker: message => { picker.fail(message) },
      closeModelPicker: picker.close,
    }),
  }, OpenCodeGoPluginCard))
}
