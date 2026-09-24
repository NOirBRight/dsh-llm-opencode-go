// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearProviderUsageCache,
  dropPersistedUsageKeys,
  peekCachedUsage,
  rememberCachedUsage,
} from 'dsh-llm-providers-ui/usage-readers'
import type { ProviderUsageSummary } from 'dsh-llm-providers-ui/usage-readers'
import {
  clearOpenCodeGoUsageCacheForTests,
  createOpenCodeGoUsageReader,
  peekOpenCodeGoUsageView,
  persistOpenCodeGoUsage,
} from '../src/client/usage-reader.ts'
import { OPENCODE_GO_ENTRY_ID } from '../src/client-contract.ts'

afterEach(() => {
  clearOpenCodeGoUsageCacheForTests()
  clearProviderUsageCache()
})

const fullShared: ProviderUsageSummary = {
  providerKey: OPENCODE_GO_ENTRY_ID,
  name: 'OpenCode Go',
  status: 'ready',
  fetchedAt: '2026-09-02T00:00:00.000Z',
  windows: [
    { id: 'session', label: '5-hour window', shortLabel: '5h', valueText: '90%', remainingPercent: 90, resetsAt: '2026-09-02T05:00:00.000Z' },
    { id: 'weekly', label: 'Weekly window', shortLabel: 'W', valueText: '70%', remainingPercent: 70, resetsAt: '2026-09-09T00:00:00.000Z' },
    { id: 'monthly', label: 'Monthly window', shortLabel: 'M', valueText: '40%', remainingPercent: 40 },
  ],
}

const partialView = { fetchedAt: '2026-09-10T03:01:00.000Z', weekly: { usage: 0.2, models: [] } }

function sharedWindowIds(): string[] | undefined {
  return peekCachedUsage(OPENCODE_GO_ENTRY_ID)?.windows.map(window => window.id)
}

describe('OpenCode Go usage cache', () => {
  it('round-trips a decoded view and replaces it on a later persist', () => {
    persistOpenCodeGoUsage({ fetchedAt: '2026-09-10T03:00:00.000Z', weekly: { usage: 0.5, models: [] } })
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.5)
    persistOpenCodeGoUsage(partialView)
    expect(peekOpenCodeGoUsageView()?.fetchedAt).toBe('2026-09-10T03:01:00.000Z')
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.2)
  })

  it('rejects malformed stored JSON', () => {
    persistOpenCodeGoUsage({ fetchedAt: '2026-09-10T03:00:00.000Z', weekly: { usage: 0.5, models: [] } })
    clearOpenCodeGoUsageCacheForTests()
    globalThis.sessionStorage?.setItem('dsh-llm-opencode-go:usage-view', '{"fetchedAt":1}')
    expect(peekOpenCodeGoUsageView()).toBeUndefined()
  })

  it('cannot overwrite a store-owned full shared quota from persist or the declared reader', async () => {
    rememberCachedUsage(fullShared)
    persistOpenCodeGoUsage(partialView)
    expect(sharedWindowIds()).toEqual(['session', 'weekly', 'monthly'])
    expect(peekCachedUsage(OPENCODE_GO_ENTRY_ID)?.fetchedAt).toBe('2026-09-02T00:00:00.000Z')
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.2)

    const reader = createOpenCodeGoUsageReader()
    const read = await reader.read({
      call: async () => ({
        ok: true as const,
        value: { status: 'ok', usage: { fetchedAt: '2026-09-10T04:00:00.000Z', weekly: { usage: 0.9, models: [] } } },
      }),
    } as never, false, new AbortController().signal)
    expect(read.status).toBe('ready')
    expect(sharedWindowIds()).toEqual(['session', 'weekly', 'monthly'])
    expect(peekCachedUsage(OPENCODE_GO_ENTRY_ID)?.windows).toHaveLength(3)
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.9)
  })

  it('does not revive a dropped shared quota after logout invalidation', async () => {
    rememberCachedUsage(fullShared)
    dropPersistedUsageKeys([OPENCODE_GO_ENTRY_ID])
    expect(peekCachedUsage(OPENCODE_GO_ENTRY_ID)).toBeUndefined()

    persistOpenCodeGoUsage(partialView)
    expect(peekCachedUsage(OPENCODE_GO_ENTRY_ID)).toBeUndefined()
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.2)

    const reader = createOpenCodeGoUsageReader()
    await reader.read({
      call: async () => ({
        ok: true as const,
        value: { status: 'ok', usage: { fetchedAt: '2026-09-10T04:00:00.000Z', weekly: { usage: 0.4, models: [] } } },
      }),
    } as never, false, new AbortController().signal)
    expect(peekCachedUsage(OPENCODE_GO_ENTRY_ID)).toBeUndefined()
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.4)
  })

  it('emits ranked short labels so the shared sidebar picks the monthly window', async () => {
    const reader = createOpenCodeGoUsageReader()
    const read = await reader.read({
      call: async () => ({
        ok: true as const,
        value: {
          status: 'ok',
          usage: {
            fetchedAt: '2026-09-10T04:00:00.000Z',
            session: { usage: 0.1, models: [] },
            weekly: { usage: 0.2, models: [] },
            monthly: { usage: 0.3, models: [] },
          },
        },
      }),
    } as never, false, new AbortController().signal)
    expect(read).toMatchObject({
      status: 'ready',
      windows: [
        { id: 'session', shortLabel: '5h' },
        { id: 'weekly', shortLabel: 'W' },
        { id: 'monthly', shortLabel: 'M' },
      ],
    })
  })
})
