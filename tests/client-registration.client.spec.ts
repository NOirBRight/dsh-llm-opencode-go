// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { OpenCodeGoSettingsView } from '../src/client-contract.ts'
import {
  OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
  OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
  OPENCODE_GO_ENTRY_ID,
  OPENCODE_GO_RPC_ENDPOINT,
} from '../src/client-contract.ts'
import { apply, inject } from '../src/client/index.ts'

// 15_000 ms is MISSING_OWNER_GRACE_MS in src/client/index.ts, which stays module-private.
const MISSING_OWNER_GRACE_MS = 15_000
import type { OpenCodeGoPluginCardFace } from '../src/client/OpenCodeGoPluginCard.tsx'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

const value: OpenCodeGoSettingsView = {
  apiKeyEnv: 'OPENCODE_GO_API_KEY',
  baseURL: 'https://opencode.ai/zen/go/v1',
  models: [],
  defaultContextWindow: 262_144,
  streamIdleTimeoutMs: 300_000,
}

function configForm() {
  let snapshot: ConfigFormSnapshot<OpenCodeGoSettingsView> = {
    status: 'ready',
    value,
    base: value,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
  }
  const listeners = new Set<() => void>()
  const mutate = vi.fn(async (ops: Parameters<ConfigForm<OpenCodeGoSettingsView>['mutate']>[0], expectedRevision?: number) => {
    if (snapshot.value === undefined || snapshot.revision === undefined || expectedRevision !== snapshot.revision || !snapshot.writable) {
      return false
    }
    const next = { ...snapshot.value }
    for (const op of ops) {
      if (op.op !== 'set' || op.path.length !== 1) continue
      const field = op.path[0]
      if (field === 'baseURL') next.baseURL = op.value as string
      if (field === 'models') next.models = op.value as OpenCodeGoSettingsView['models']
    }
    snapshot = { ...snapshot, value: next, revision: snapshot.revision + 1 }
    listeners.forEach(listener => { listener() })
    return true
  })
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    mutate,
    set: vi.fn((field: string, next: unknown) => mutate([{ op: 'set', path: [field], value: next }], snapshot.revision)),
    unset: vi.fn((field: string) => mutate([{ op: 'unset', path: [field] }], snapshot.revision)),
  }
}

interface SlotEntry {
  options: Record<string, unknown>
  inject?: () => unknown
}

class FakeSlots extends Service {
  private readonly registered: SlotEntry[] = []
  private readonly listeners = new Map<string, Set<() => void>>()

  constructor(ctx: Context) { super(ctx, 'slots') }

  inject(_name: string, register: () => () => void): void { this.ctx.effect(register) }

  subscribe(name: string, listener: () => void): () => void {
    const listeners = this.listeners.get(name) ?? new Set()
    listeners.add(listener)
    this.listeners.set(name, listeners)
    return () => { listeners.delete(listener) }
  }

  register(options: Record<string, unknown> & { inject?: () => unknown }, _component: unknown): () => void {
    const entry = { options, inject: options.inject }
    this.registered.push(entry)
    for (const listener of this.listeners.get(String(options['name'])) ?? []) listener()
    return () => {
      const index = this.registered.indexOf(entry)
      if (index >= 0) this.registered.splice(index, 1)
    }
  }

  entries(name: string): readonly SlotEntry[] {
    return this.registered.filter(entry => entry.options['name'] === name)
  }
}

async function bench(
  call = vi.fn(() => Promise.resolve({ ok: true, value: { models: [] } })),
  openCodeGoSettings = configForm(),
) {
  const ctx = new Context()
  await ctx.plugin(FakeSlots).await()
  const slots = ctx.get('slots') as FakeSlots
  ctx.provide('locale', {
    register: () => () => undefined,
    bind: () => (key: string) => key,
  } as never)
  ctx.provide('configForms', { get: () => openCodeGoSettings } as never)
  ctx.provide('connection', { rpc: { call } } as never)
  return { ctx, slots, openCodeGoSettings }
}

describe('OpenCode Go client plugin registration', () => {
  it('declares only the client services it consumes', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'configForms'])
  })

  it('registers the card and frame picker, then removes both with the plugin fiber', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(slots.entries('settings.section')).toHaveLength(0) // owned by dsh-llm-providers-ui
    const entries = slots.entries('settings.provider.item')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.options).toMatchObject({ key: 'llm-opencode-go' })
    const face = (entries[0] as { inject?: () => unknown }).inject?.() as { hooks: Record<string, unknown> }
    expect(Object.keys(face.hooks)).toEqual(['openCodeGoSettings'])
    const overlays = slots.entries('shell.overlay')
    expect(overlays).toHaveLength(1)
    expect(overlays[0]?.options).toMatchObject({ id: 'opencode-go-model-picker', order: 100 })

    await fiber.dispose()

    expect(slots.entries('settings.provider.item')).toHaveLength(0)
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(slots.entries('shell.overlay')).toHaveLength(0)
    await ctx.fiber.dispose()
  })

  // The owner registers the providers section after the settings snapshot arrives and
  // the page becomes visible, so the diagnostic waits out a grace period before warning.
  const missingOwnerWarnings = (warning: ReturnType<typeof vi.spyOn>): number =>
    warning.mock.calls.filter(([message]) => String(message).includes('LLM Providers page missing')).length

  it('warns once when the provider page owner is still absent after the grace period', async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctx } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.advanceTimersByTimeAsync(0)
    expect(missingOwnerWarnings(warning)).toBe(0)
    await vi.advanceTimersByTimeAsync(MISSING_OWNER_GRACE_MS)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('LLM Providers page missing'))
    expect(missingOwnerWarnings(warning)).toBe(1)
    await fiber.dispose()
    // Well past the grace window; disposer must keep the warning single-shot.
    await vi.advanceTimersByTimeAsync(MISSING_OWNER_GRACE_MS * 4)
    expect(missingOwnerWarnings(warning)).toBe(1)
    await ctx.fiber.dispose()
  })

  it('does not warn when the provider page owner registers inside the grace period', async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const removeOwner = slots.register({ name: 'settings.section', id: 'providers' }, undefined)
    removeOwner()
    await vi.advanceTimersByTimeAsync(MISSING_OWNER_GRACE_MS * 4)
    expect(missingOwnerWarnings(warning)).toBe(0)
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('does not warn when the provider page owner is already registered', async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctx, slots } = await bench()
    const removeOwner = slots.register({ name: 'settings.section', id: 'providers' }, undefined)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.advanceTimersByTimeAsync(MISSING_OWNER_GRACE_MS * 4)
    expect(missingOwnerWarnings(warning)).toBe(0)
    await fiber.dispose()
    removeOwner()
    await ctx.fiber.dispose()
  })

  it('reuses the accepted ConfigForm revision on the next save', async () => {
    const openCodeGoSettings = configForm()
    const { ctx, slots } = await bench(undefined, openCodeGoSettings)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]?.inject?.() as OpenCodeGoPluginCardFace

    await face.saveConfiguration({ ...value, models: [{ id: 'first' }] }, 1)
    await face.saveConfiguration({ ...value, models: [{ id: 'first' }, { id: 'second' }] }, 2)
    expect(openCodeGoSettings.mutate.mock.calls.map(([, expectedRevision]) => expectedRevision)).toEqual([1, 2])
    expect(openCodeGoSettings.mutate.mock.calls.map(([ops]) => ops.map(op => op.path))).toEqual([[['models']], [['models']]])
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('rejects a stale card snapshot before it can overwrite settings or save its credential', async () => {
    const call = vi.fn(() => Promise.resolve({ ok: true, value: {} }))
    const openCodeGoSettings = configForm()
    const { ctx, slots } = await bench(call, openCodeGoSettings)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const face = slots.entries('settings.provider.item')[0]?.inject?.() as OpenCodeGoPluginCardFace

    await face.saveConfiguration({ ...value, baseURL: 'https://saved-in-tab.test/v1' }, 1)
    await expect(face.saveConfiguration({ ...value, baseURL: 'https://saved-in-tab.test/v1' }, 1)).rejects.toThrow()
    await expect(face.saveConfiguration({
      ...value,
      models: [{ id: 'stale-model' }],
    }, 1, 'stale-key')).rejects.toThrow()

    expect(openCodeGoSettings.getSnapshot().value).toMatchObject({
      baseURL: 'https://saved-in-tab.test/v1',
      models: [],
    })
    expect(openCodeGoSettings.getSnapshot().revision).toBe(2)
    expect(call).not.toHaveBeenCalledWith(
      '/api',
      OPENCODE_GO_RPC_ENDPOINT,
      expect.objectContaining({ endpoint: OPENCODE_GO_CREDENTIAL_SET_ENDPOINT }),
      expect.any(AbortSignal),
    )

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('keeps a saved account when an older credential-status read finishes later', async () => {
    let resolveRead: (value: unknown) => void
    const olderRead = new Promise<unknown>(resolve => { resolveRead = resolve })
    const call = vi.fn((_carrier: string, _method: string, wrapped: unknown) => {
      const endpoint = typeof wrapped === 'object' && wrapped !== null && 'endpoint' in wrapped
        ? wrapped.endpoint
        : undefined
      if (endpoint === OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT) return olderRead
      if (endpoint === OPENCODE_GO_CREDENTIAL_SET_ENDPOINT) {
        return Promise.resolve({ ok: true, value: { configured: true } })
      }
      return Promise.resolve({ ok: true, value: {} })
    })
    const { ctx, slots } = await bench(call)
    let entry: { account(): { state: string } } | undefined
    ctx.provide('providerDirectory', {
      register: (next: typeof entry) => { entry = next; return () => undefined },
      update: vi.fn(),
      invalidateUsage: vi.fn(),
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => {
      expect(call).toHaveBeenCalledWith('/api', OPENCODE_GO_RPC_ENDPOINT, {
        endpoint: OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
        payload: {},
      }, expect.any(AbortSignal))
    })
    const face = slots.entries('settings.provider.item')[0]?.inject?.() as {
      storeApiKey(value: string): Promise<void>
    }
    await face.storeApiKey('new-key')
    expect(entry?.account().state).toBe('configured')
    resolveRead({ ok: true, value: { configured: false, writable: true } })
    await vi.waitFor(() => { expect(entry?.account().state).toBe('configured') })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })
})
