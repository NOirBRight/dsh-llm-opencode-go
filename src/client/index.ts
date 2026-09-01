/** Browser half: OpenCode Go setup inside Plugin configuration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  decodeOpenCodeGoDiscoveryResult,
  decodeOpenCodeGoSaveResult,
  decodeOpenCodeGoSettingsReadResult,
  decodeOpenCodeGoUsageReply,
  OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
  OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_RPC_CHANNEL,
  OPENCODE_GO_SAVE_ENDPOINT,
  OPENCODE_GO_SETTINGS_READ_ENDPOINT,
  OPENCODE_GO_SETTINGS_NAMESPACE,
  OPENCODE_GO_USAGE_ENDPOINT,
} from '../client-contract.ts'
import type { OpenCodeGoDiscoveryRequest, OpenCodeGoSettingsView } from '../client-contract.ts'
import { OpenCodeGoPluginCard } from './OpenCodeGoPluginCard.tsx'
import type { OpenCodeGoPluginCardFace } from './OpenCodeGoPluginCard.tsx'
import { OpenCodeGoModelPicker, OpenCodeGoModelPickerController } from './OpenCodeGoModelPicker.tsx'
import type { OpenCodeGoModelPickerFace } from './OpenCodeGoModelPicker.tsx'
import { en, zh } from './locales.ts'
import type { OpenCodeGoSettingsKey } from './locales.ts'


declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'settings.provider.item': { kind: 'keyed'; scope: 'root' }
  }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** OpenCode Go Plugin configuration copy. */
    'settings.opencode-go': OpenCodeGoSettingsKey
  }
}

/** Stable browser-plugin name. */
export const name = 'dsh-llm-opencode-go-client'
/** Client services required by the Plugin configuration contribution. */
export const inject = ['slots', 'locale', 'connection']

/** Register localized OpenCode Go configuration under Plugin configuration. */
export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.opencode-go'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-llm-opencode-go: Plugin configuration copy',
  )
  const t = ctx.locale.bind(localeNamespace) as OpenCodeGoPluginCardFace['t']
  let snapshot: SettingsScopeSnapshot<OpenCodeGoSettingsView> = { status: 'loading', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false, mode: 'memory' }
  const listeners = new Set<() => void>()
  const scope: SettingsScope<OpenCodeGoSettingsView> = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    mutate: async () => { throw new Error('settings are managed by the provider RPC') },
    set: async () => { throw new Error('settings are managed by the provider RPC') },
    unset: async () => { throw new Error('settings are managed by the provider RPC') },
  }
  const updateSnapshot = (next: SettingsScopeSnapshot<OpenCodeGoSettingsView>): void => { snapshot = next; listeners.forEach(listener => { listener() }) }
  const picker = new OpenCodeGoModelPickerController()
  const connection: ConnectionHandle = ctx.reflect.get('connection')
  const { rpc } = connection

  const readManagement = async (): Promise<void> => {
    const result = await callPlugin(OPENCODE_GO_SETTINGS_READ_ENDPOINT, {})
    if (!result.ok) { updateSnapshot({ ...snapshot, status: 'unavailable' }); throw new Error(result.error.message) }
    const decoded = decodeOpenCodeGoSettingsReadResult(result.value)
    if (decoded === undefined) { updateSnapshot({ ...snapshot, status: 'unavailable' }); throw new Error(t('requestFailed')) }
    updateSnapshot({ status: 'ready', value: decoded.settings, base: decoded.settings, user: decoded.settings, revision: decoded.revision, writable: true, mode: 'host' })
  }

  const describeCredential: OpenCodeGoPluginCardFace['describeCredential'] = async () => {
    const result = await callPlugin(OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, {})
    if (!result.ok) throw new Error(result.error.message)
    const credential = result.value as { configured?: unknown, writable?: unknown }
    if (typeof credential.configured !== 'boolean' || typeof credential.writable !== 'boolean') throw new Error(t('requestFailed'))
    return { configured: credential.configured, writable: credential.writable }
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

  void Promise.resolve().then(readManagement).catch(() => undefined)

  const saveConfiguration: OpenCodeGoPluginCardFace['saveConfiguration'] = async (settings, apiKey) => {
    if (apiKey !== undefined) await storeApiKey(apiKey)
    const current = scope.getSnapshot()
    if (current.revision === undefined) throw new Error(t('requestFailed'))
    const result = await callPlugin(OPENCODE_GO_SAVE_ENDPOINT, {
      baseURL: settings.baseURL,
      models: settings.models,
      expectedRevision: current.revision,
    })
    if (!result.ok) throw new Error(result.error.message)
    const accepted = decodeOpenCodeGoSaveResult(result.value)
    if (accepted === undefined) throw new Error(t('requestFailed'))
    return accepted
  }

  const storeApiKey: OpenCodeGoPluginCardFace['storeApiKey'] = async (value) => {
    if (value.trim().length === 0) throw new Error(t('invalidApiKey'))
    const result = await callPlugin(OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, { apiKey: value })
    if (!result.ok) throw new Error(result.error.message)
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
  ctx.effect(() => {
    let warned = false
    const check = (): void => {
      if (ctx.slots.entries('settings.section').some(entry => entry.options.id === 'providers') || warned) return
      warned = true
      console.warn('[dsh-llm-providers-ui] LLM Providers page missing for card llm-opencode-go: install dsh-llm-providers-ui to show the card. Host route remains active.')
    }
    const timer = setTimeout(check, 0)
    const stop = ctx.slots.subscribe('settings.section', check)
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, 'dsh-llm-providers-ui: missing owner diagnostic')

}
