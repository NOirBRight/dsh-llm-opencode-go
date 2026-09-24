/** Browser half: OpenCode Go setup inside Plugin configuration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  decodeOpenCodeGoDiscoveryResult,
  decodeOpenCodeGoUsageReply,
  OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
  OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_ENTRY_ID,
  OPENCODE_GO_RPC_ENDPOINT,
  OPENCODE_GO_USAGE_ENDPOINT,
  OPENCODE_GO_VALIDATE_ENDPOINT,
} from '../client-contract.ts'
import type { OpenCodeGoDiscoveryRequest, OpenCodeGoSettingsView } from '../client-contract.ts'
import { OpenCodeGoPluginCard } from './OpenCodeGoPluginCard.tsx'
import type { OpenCodeGoPluginCardFace } from './OpenCodeGoPluginCard.tsx'
import { OpenCodeGoModelPicker, OpenCodeGoModelPickerController } from './OpenCodeGoModelPicker.tsx'
import type { OpenCodeGoModelPickerFace } from './OpenCodeGoModelPicker.tsx'
import { en, zh } from './locales.ts'
import type { OpenCodeGoSettingsKey } from './locales.ts'
import { createOpenCodeGoUsageReader } from './usage-reader.ts'


import type {} from 'dsh-llm-providers-ui/client'

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

/** Grace period for dsh-llm-providers-ui to register the providers settings section before the missing-owner warning fires. */
const MISSING_OWNER_GRACE_MS = 15_000

/** Stable browser-plugin name. */
export const name = 'dsh-llm-opencode-go-client'
/** Client services required by the Plugin configuration contribution. */
export const inject = ['slots', 'locale', 'connection', 'configForms']

/** Register localized OpenCode Go configuration under Plugin configuration. */
export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.opencode-go'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-llm-opencode-go: Plugin configuration copy',
  )
  const t = ctx.locale.bind(localeNamespace) as OpenCodeGoPluginCardFace['t']
  let closed = false
  const openCodeGoSettings: ConfigForm<OpenCodeGoSettingsView> = ctx.configForms.get(OPENCODE_GO_ENTRY_ID)
  const picker = new OpenCodeGoModelPickerController()
  const account = { state: 'unknown' as 'connected' | 'configured' | 'unconnected' | 'unknown' }
  let accountEpoch = 0
  const publishAccount = (state: typeof account.state): void => {
    if (closed || account.state === state) return
    account.state = state
    try { ctx.get('providerDirectory')?.update(OPENCODE_GO_ENTRY_ID) } catch { /* providerDirectory is optional in lab */ }
  }
  const connection: ConnectionHandle = ctx.reflect.get('connection')
  const { rpc } = connection

  const describeCredential: OpenCodeGoPluginCardFace['describeCredential'] = async () => {
    const epoch = accountEpoch
    const result = await callPlugin(OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, {})
    if (!result.ok) throw new Error(result.error.message)
    const credential = result.value as { configured?: unknown, writable?: unknown }
    if (typeof credential.configured !== 'boolean' || typeof credential.writable !== 'boolean') throw new Error(t('requestFailed'))
    if (epoch === accountEpoch) publishAccount(credential.configured ? 'configured' : 'unconnected')
    return { configured: credential.configured, writable: credential.writable }
  }

  const callPlugin = async (endpoint: string, payload: unknown) => {
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, 20_000)
    try {
      return await rpc.call('/api', OPENCODE_GO_RPC_ENDPOINT, { endpoint, payload }, controller.signal)
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new Error(t('requestFailed'))
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  const saveConfiguration: OpenCodeGoPluginCardFace['saveConfiguration'] = async (settings, sourceRevision, apiKey) => {
    const source = openCodeGoSettings.getSnapshot()
    if (source.status !== 'ready' || source.value === undefined || source.revision !== sourceRevision || !source.writable) {
      throw new Error(t('requestFailed'))
    }
    if (apiKey !== undefined) await storeApiKey(apiKey)
    const current = openCodeGoSettings.getSnapshot()
    if (current.status !== 'ready' || current.value === undefined || current.revision !== sourceRevision || !current.writable) {
      throw new Error(t('requestFailed'))
    }
    const ops: SettingsPathOpView[] = []
    if (current.value.baseURL !== settings.baseURL) {
      ops.push({ op: 'set', path: ['baseURL'], value: settings.baseURL })
    }
    if (JSON.stringify(current.value.models) !== JSON.stringify(settings.models)) {
      const models = JSON.parse(JSON.stringify(settings.models))
      ops.push({ op: 'set', path: ['models'], value: models })
    }
    if (ops.length > 0) {
      const checked = await callPlugin(OPENCODE_GO_VALIDATE_ENDPOINT, { baseURL: settings.baseURL, models: settings.models })
      if (!checked.ok) throw new Error(checked.error.message)
      const latest = openCodeGoSettings.getSnapshot()
      if (latest.status !== 'ready' || latest.value === undefined || latest.revision !== sourceRevision || !latest.writable) {
        throw new Error(t('requestFailed'))
      }
      if (!await openCodeGoSettings.mutate(ops, sourceRevision)) throw new Error(t('requestFailed'))
    }
    const accepted = openCodeGoSettings.getSnapshot()
    if (accepted.value === undefined || accepted.revision === undefined) throw new Error(t('requestFailed'))
    return { settings: accepted.value, revision: accepted.revision }
  }

  const storeApiKey: OpenCodeGoPluginCardFace['storeApiKey'] = async (value) => {
    if (value.trim().length === 0) throw new Error(t('invalidApiKey'))
    const result = await callPlugin(OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, { apiKey: value })
    if (!result.ok) throw new Error(result.error.message)
    ctx.get('providerDirectory')?.invalidateUsage(OPENCODE_GO_ENTRY_ID)
    const credential = result.value as { configured?: unknown }
    if (typeof credential.configured === 'boolean') {
      accountEpoch += 1
      publishAccount(credential.configured ? 'configured' : 'unconnected')
    }
  }

  const fetchUsage: OpenCodeGoPluginCardFace['fetchUsage'] = async (request: OpenCodeGoDiscoveryRequest) => {
    const result = await callPlugin(OPENCODE_GO_USAGE_ENDPOINT, request)
    if (!result.ok) {
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
    key: OPENCODE_GO_ENTRY_ID,
    locale: localeNamespace,
    inject: (): OpenCodeGoPluginCardFace => ({
      t,
      hooks: { openCodeGoSettings },
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
  ctx.inject(['providerDirectory'], (directoryScope) => {
    const directory = directoryScope.providerDirectory
    if (directory === undefined) return
    directoryScope.effect(
      () => {
        const declaration = Object.assign({
          key: OPENCODE_GO_ENTRY_ID,
          name: 'OpenCode Go',
          role: 'llm' as const,
          header: 'shared' as const,
          detail: 'shared' as const,
          usage: createOpenCodeGoUsageReader(),
          modelCount: () => openCodeGoSettings.getSnapshot().value?.models?.length,
        }, {
          catalogId: 'opencode-go',
          account: () => ({ state: account.state }),
        })
        return directory.register(declaration as Parameters<typeof directory.register>[0])
      },
      'dsh-llm-opencode-go: provider directory',
    )
  })
  ctx.effect(() => {
    void Promise.resolve().then(describeCredential).catch(() => undefined)
    return () => { closed = true }
  }, 'dsh-llm-opencode-go: account snapshot')
  ctx.effect(() => {
    let warned = false
    const hasProvidersSection = (): boolean =>
      ctx.slots.entries('settings.section').some(entry => entry.options.id === 'providers')
    const check = (): void => {
      if (hasProvidersSection() || warned) return
      warned = true
      console.warn('[dsh-llm-providers-ui] LLM Providers page missing for card llm-opencode-go: install dsh-llm-providers-ui to show the card. Host route remains active.')
    }
    const timer = setTimeout(check, MISSING_OWNER_GRACE_MS)
    const stop = ctx.slots.subscribe('settings.section', () => {
      if (!hasProvidersSection()) return
      clearTimeout(timer)
      stop()
    })
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, 'dsh-llm-providers-ui: missing owner diagnostic')
}
