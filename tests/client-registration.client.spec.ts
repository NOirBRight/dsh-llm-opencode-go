// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { OpenCodeGoSettingsView } from '../src/client-contract.ts'
import { apply, inject } from '../src/client/index.ts'

afterEach(() => { vi.restoreAllMocks() })

const value: OpenCodeGoSettingsView = {
  apiKeyEnv: 'OPENCODE_GO_API_KEY',
  baseURL: 'https://opencode.ai/zen/go/v1',
  models: [],
  defaultContextWindow: 262_144,
  streamIdleTimeoutMs: 300_000,
}

function scope(): SettingsScope<OpenCodeGoSettingsView> {
  const snapshot: SettingsScopeSnapshot<OpenCodeGoSettingsView> = {
    status: 'ready',
    value,
    base: value,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    mutate: vi.fn(() => Promise.resolve()),
    set: vi.fn(() => Promise.resolve()),
    unset: vi.fn(() => Promise.resolve()),
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

async function bench() {
  const ctx = new Context()
  await ctx.plugin(FakeSlots).await()
  const slots = ctx.get('slots') as FakeSlots
  ctx.provide('locale', {
    register: () => () => undefined,
    bind: () => (key: string) => key,
  } as never)
  ctx.provide('settingsScope', { bind: () => scope() } as never)
  ctx.provide('remote', { $on: () => () => undefined } as never)
  ctx.provide('connection', {
    api: {
      credentials: {
        describe: vi.fn(() => Promise.resolve({
          rpcId: 'credential',
          result: { ok: true, value: { credentials: {} } },
        })),
        set: vi.fn(() => Promise.resolve({ rpcId: 'credential', result: { ok: true, value: {} } })),
      },
    },
    rpc: {
      call: vi.fn(() => Promise.resolve({ ok: true, value: { models: [] } })),
    },
  } as never)
  return { ctx, slots }
}

describe('OpenCode Go client plugin registration', () => {
  it('declares only the client services it consumes', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection'])
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

  it('warns only when the provider page owner is absent', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctx } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('LLM Providers page missing'))
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('does not warn when the provider page owner is already registered', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctx, slots } = await bench()
    const removeOwner = slots.register({ name: 'settings.section', id: 'providers' }, undefined)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(warning).not.toHaveBeenCalled()
    await fiber.dispose()
    removeOwner()
    await ctx.fiber.dispose()
  })
})
