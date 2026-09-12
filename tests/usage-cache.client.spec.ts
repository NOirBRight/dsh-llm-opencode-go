// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearOpenCodeGoUsageCacheForTests,
  peekOpenCodeGoUsageView,
  persistOpenCodeGoUsage,
} from '../src/client/usage-reader.ts'

afterEach(() => { clearOpenCodeGoUsageCacheForTests() })

describe('OpenCode Go usage cache', () => {
  it('round-trips a decoded view and replaces it on a later persist', () => {
    persistOpenCodeGoUsage({ fetchedAt: '2026-09-10T03:00:00.000Z', weekly: { usage: 0.5, models: [] } })
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.5)
    persistOpenCodeGoUsage({ fetchedAt: '2026-09-10T03:01:00.000Z', weekly: { usage: 0.2, models: [] } })
    expect(peekOpenCodeGoUsageView()?.fetchedAt).toBe('2026-09-10T03:01:00.000Z')
    expect(peekOpenCodeGoUsageView()?.weekly?.usage).toBe(0.2)
  })

  it('rejects malformed stored JSON', () => {
    persistOpenCodeGoUsage({ fetchedAt: '2026-09-10T03:00:00.000Z', weekly: { usage: 0.5, models: [] } })
    clearOpenCodeGoUsageCacheForTests()
    globalThis.sessionStorage?.setItem('dsh-llm-opencode-go:usage-view', '{"fetchedAt":1}')
    expect(peekOpenCodeGoUsageView()).toBeUndefined()
  })
})
