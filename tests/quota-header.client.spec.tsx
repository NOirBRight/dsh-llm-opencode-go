// @vitest-environment jsdom
// Collapsed header quota: usage loads without expansion, expansion never refires, failures stay truthful.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { OpenCodeGoPluginCard } from '../src/client/OpenCodeGoPluginCard.tsx'
import type { OpenCodeGoPluginCardProps } from '../src/client/OpenCodeGoPluginCard.tsx'
import { en } from '../src/client/locales.ts'
import { clearProviderUsageCache, peekCachedUsage, rememberHeadlineQuota } from 'dsh-llm-providers-ui/usage-readers'
import type { OpenCodeGoSettingsView } from '../src/client-contract.ts'

afterEach(() => { cleanup(); clearProviderUsageCache() })

const settings: OpenCodeGoSettingsView = {
  apiKeyEnv: 'OPENCODE_GO_API_KEY',
  baseURL: 'https://opencode.ai/zen/go/v1',
  models: [],
  defaultContextWindow: 4096,
  streamIdleTimeoutMs: 300_000,
}

const usageOk = {
  kind: 'ok' as const,
  usage: { fetchedAt: '2026-09-01T00:00:00.000Z', monthly: { usage: 0.1, models: [] } },
}

function props(overrides: Record<string, unknown> = {}): OpenCodeGoPluginCardProps {
  const current: SettingsScopeSnapshot<OpenCodeGoSettingsView> = {
    status: 'ready', value: settings, base: settings, user: {}, revision: 1, writable: true, mode: 'host',
  }
  return {
    t: (key: keyof typeof en) => en[key],
    useOpenCodeGoSettings: (selector: (value: SettingsScopeSnapshot<OpenCodeGoSettingsView>) => unknown) => selector(current),
    describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
    storeApiKey: vi.fn(() => Promise.resolve()),
    saveConfiguration: vi.fn(next => Promise.resolve({ settings: next, revision: 2 })),
    discoverModels: vi.fn(() => Promise.resolve([])),
    fetchUsage: vi.fn(() => Promise.resolve(usageOk)),
    beginModelPicker: vi.fn(),
    completeModelPicker: vi.fn(),
    failModelPicker: vi.fn(),
    closeModelPicker: vi.fn(),
    ...overrides,
  } as unknown as OpenCodeGoPluginCardProps
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(value => {
    resolve = value
  })
  return { promise, resolve }
}

describe('OpenCodeGoPluginCard collapsed quota', () => {
  it('shows header quota while collapsed and does not reload on expansion', async () => {
    const fetchUsage = vi.fn(() => Promise.resolve(usageOk))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    const meter = await screen.findByRole('meter', { name: en.usageMonthly })
    expect(meter.getAttribute('aria-valuenow')).toBe('90')
    expect(fetchUsage).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    await screen.findByRole('button', { name: en.usageRefresh })
    expect(screen.getAllByRole('meter', { name: en.usageMonthly }).length).toBeGreaterThanOrEqual(2)
    expect(fetchUsage).toHaveBeenCalledTimes(1)
  })

  it('reports a usage read failure truthfully with a collapsed unavailable dash', async () => {
    const fetchUsage = vi.fn(() => Promise.reject(new Error('quota read failed')))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    await waitFor(() => { expect(fetchUsage).toHaveBeenCalledTimes(1) })
    // Truthful unavailable state: dash mini, never a fabricated percent.
    await waitFor(() => { expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-missing]')).not.toBeNull() })
    expect(screen.queryByRole('meter')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    await screen.findByText('quota read failed')
    expect(fetchUsage).toHaveBeenCalledTimes(1)
  })

  it('ignores seeded cache when the endpoint reports unsupported', async () => {
    rememberHeadlineQuota('llm-opencode-go', 'OpenCode Go', { remainingPercent: 80, label: 'seeded' })
    const fetchUsage = vi.fn(() => Promise.resolve({ kind: 'unsupported' as const }))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    await waitFor(() => { expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-missing]')).not.toBeNull() })
    expect(screen.queryByRole('meter')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    await screen.findByText(en.usageUnsupported)
  })

  it('shows seeded cache while credential is still unknown', async () => {
    rememberHeadlineQuota('llm-opencode-go', 'OpenCode Go', { remainingPercent: 64, label: 'seeded' })
    const describeCredential = vi.fn(() => new Promise<never>(() => {}))
    const useOpenCodeGoSettings = (selector: (value: unknown) => unknown): unknown =>
      selector({ status: 'loading', value: undefined, base: {}, user: {}, revision: 0, writable: true, mode: 'host' })
    render(<OpenCodeGoPluginCard {...props({ describeCredential, useOpenCodeGoSettings })} />)

    const meter = await screen.findByRole('meter', { name: 'seeded' })
    expect(meter.getAttribute('aria-valuenow')).toBe('64')
  })

  it('drops a superseded read so old-account usage cannot resurrect', async () => {
    const usageA = { kind: 'ok' as const, usage: { fetchedAt: '2026-09-01T00:00:00.000Z', monthly: { usage: 0.9, models: [] } } }
    const usageB = { kind: 'ok' as const, usage: { fetchedAt: '2026-09-01T00:00:00.000Z', monthly: { usage: 0.05, models: [] } } }
    const first = deferred<typeof usageA>()
    const second = deferred<typeof usageB>()
    const fetchUsage = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const saveConfiguration = vi.fn((next: unknown) => Promise.resolve({ settings: next, revision: 2 }))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage, saveConfiguration })} />)
    await waitFor(() => { expect(fetchUsage).toHaveBeenCalledTimes(1) })
    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    fireEvent.change(screen.getByLabelText(en.apiKey), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(fetchUsage).toHaveBeenCalledTimes(2) })
    second.resolve(usageB)
    await waitFor(() => { expect(screen.getAllByRole('meter', { name: en.usageMonthly }).map(meter => meter.getAttribute('aria-valuenow'))).toEqual(['95', '95']) })
    first.resolve(usageA)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.getAllByRole('meter', { name: en.usageMonthly }).every(meter => meter.getAttribute('aria-valuenow') === '95')).toBe(true)
  })

  it('drops an old read resolving mid-save before the fresh read starts', async () => {
    const usageA = { kind: 'ok' as const, usage: { fetchedAt: '2026-09-01T00:00:00.000Z', monthly: { usage: 0.9, models: [] } } }
    const first = deferred<typeof usageA>()
    const fetchUsage = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(() => Promise.resolve(usageOk))
    let resolveSave!: (value: unknown) => void
    const saveGate = new Promise<unknown>(value => {
      resolveSave = value
    })
    const saveConfiguration = vi.fn((next: unknown) => saveGate.then(() => ({ settings: next, revision: 2 })))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage, saveConfiguration })} />)
    await waitFor(() => { expect(fetchUsage).toHaveBeenCalledTimes(1) })
    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    fireEvent.change(screen.getByLabelText(en.apiKey), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    first.resolve(usageA)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(peekCachedUsage('llm-opencode-go')).toBeUndefined()
    expect(screen.queryByRole('meter')).toBeNull()
    resolveSave(undefined)
    await waitFor(() => { expect(screen.getAllByRole('meter', { name: en.usageMonthly }).map(meter => meter.getAttribute('aria-valuenow'))).toEqual(['90', '90']) })
  })

  it('drops a late read after unmount without caching it', async () => {
    expect(peekCachedUsage('llm-opencode-go')).toBeUndefined()
    const gate = deferred<typeof usageOk>()
    const fetchUsage = vi.fn(() => gate.promise)
    const view = render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)
    await waitFor(() => { expect(fetchUsage).toHaveBeenCalledTimes(1) })
    view.unmount()
    gate.resolve(usageOk)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(peekCachedUsage('llm-opencode-go')).toBeUndefined()
  })

  it('shows a dash after a refresh fails following a success, never stale live quota', async () => {
    let mode: 'ok' | 'fail' = 'ok'
    const fetchUsage = vi.fn(() => mode === 'ok'
      ? Promise.resolve(usageOk)
      : Promise.reject(new Error('refresh boom')))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)
    expect((await screen.findByRole('meter', { name: en.usageMonthly })).getAttribute('aria-valuenow')).toBe('90')
    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    await screen.findByRole('button', { name: en.usageRefresh })
    mode = 'fail'
    fireEvent.click(screen.getByRole('button', { name: en.usageRefresh }))
    await waitFor(() => { expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-missing]')).not.toBeNull() })
    expect(document.querySelector('[data-provider-quota-mini] [data-provider-quota-meter]')).toBeNull()
  })

  it('drops a stale credential read after save-new-key without hiding quota', async () => {
    let resolveCredential!: (value: unknown) => void
    const credentialGate = new Promise<unknown>(value => {
      resolveCredential = value
    })
    const describeCredential = vi.fn()
      .mockReturnValueOnce(credentialGate)
      .mockResolvedValue({ configured: true, writable: true })
    const saveConfiguration = vi.fn((next: unknown) => Promise.resolve({ settings: next, revision: 2 }))
    render(<OpenCodeGoPluginCard {...props({ describeCredential, saveConfiguration })} />)
    await waitFor(() => { expect(describeCredential).toHaveBeenCalledTimes(1) })
    fireEvent.click(screen.getByRole('button', { name: en.expand + ': ' + en.title }))
    fireEvent.change(screen.getByLabelText(en.apiKey), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(describeCredential).toHaveBeenCalledTimes(2) })
    await screen.findByText(en.saved)
    await waitFor(() => { expect(screen.getAllByRole('meter', { name: en.usageMonthly }).map(meter => meter.getAttribute('aria-valuenow'))).toEqual(['90', '90']) })
    resolveCredential({ configured: false, writable: true })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.getAllByRole('meter', { name: en.usageMonthly }).every(meter => meter.getAttribute('aria-valuenow') === '90')).toBe(true)
  })

  it('labels unknown credential as loading instead of not-configured', async () => {
    const describeCredential = vi.fn(() => new Promise<never>(() => {}))
    render(<OpenCodeGoPluginCard {...props({ describeCredential })} />)
    await waitFor(() => { expect(describeCredential).toHaveBeenCalledTimes(1) })
    expect(document.querySelector('[data-provider-header-status]')?.textContent).toBe(en.loading)
    expect(document.querySelector('[data-provider-header-status]')?.textContent).not.toBe(en.summaryOff)
  })

  it('suppresses the model count while the snapshot has not loaded', async () => {
    const describeCredential = vi.fn(() => new Promise<never>(() => {}))
    const useOpenCodeGoSettings = (selector: (value: unknown) => unknown): unknown =>
      selector({ status: 'loading', value: undefined, base: {}, user: {}, revision: 0, writable: true, mode: 'host' })
    render(<OpenCodeGoPluginCard {...props({ describeCredential, useOpenCodeGoSettings })} />)
    await waitFor(() => { expect(describeCredential).not.toHaveBeenCalled() })
    expect(document.querySelector('[data-provider-header-summary]')?.textContent).toBe('')
    expect(document.querySelector('[data-provider-header-status]')?.textContent).toBe(en.loading)
  })

  it('hides seeded cache once credential is known false', async () => {
    rememberHeadlineQuota('llm-opencode-go', 'OpenCode Go', { remainingPercent: 64, label: 'seeded' })
    const describeCredential = vi.fn(() => Promise.resolve({ configured: false, writable: true }))
    render(<OpenCodeGoPluginCard {...props({ describeCredential })} />)

    await waitFor(() => { expect(screen.queryByRole('meter')).toBeNull() })
    expect(document.querySelector('[data-provider-quota]')).toBeNull()
  })
})
