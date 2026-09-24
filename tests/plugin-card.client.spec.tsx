// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { ProviderDetail, providerDetailCopy } from 'dsh-llm-providers-ui/provider-detail'
import { OpenCodeGoPluginCard } from '../src/client/OpenCodeGoPluginCard.tsx'
import type { OpenCodeGoPluginCardProps } from '../src/client/OpenCodeGoPluginCard.tsx'
import { en } from '../src/client/locales.ts'
import { clearOpenCodeGoUsageCacheForTests } from '../src/client/usage-reader.ts'
import type { OpenCodeGoCatalogModelConfig, OpenCodeGoSettingsView } from '../src/client-contract.ts'

afterEach(() => {
  cleanup()
  clearOpenCodeGoUsageCacheForTests()
})

const settings: OpenCodeGoSettingsView = {
  apiKeyEnv: 'OPENCODE_GO_API_KEY',
  baseURL: 'https://opencode.ai/zen/go/v1',
  models: [],
  defaultContextWindow: 4096,
  streamIdleTimeoutMs: 300_000,
}

function snapshot(overrides: Partial<ConfigFormSnapshot<OpenCodeGoSettingsView>> = {}): ConfigFormSnapshot<OpenCodeGoSettingsView> {
  return {
    status: 'ready',
    value: settings,
    base: settings,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
    ...overrides,
  }
}

function props(overrides: Partial<OpenCodeGoPluginCardProps> = {}): OpenCodeGoPluginCardProps {
  const current = snapshot()
  let adopt: ((models: readonly OpenCodeGoCatalogModelConfig[]) => void) | undefined
  return {
    t: key => en[key],
    useOpenCodeGoSettings: selector => selector(current),
    describeCredential: vi.fn(() => Promise.resolve({ configured: false, writable: true })),
    storeApiKey: vi.fn(() => Promise.resolve()),
    saveConfiguration: vi.fn((next: OpenCodeGoSettingsView, sourceRevision: number) => Promise.resolve({ settings: next, revision: sourceRevision + 1 })),
    discoverModels: vi.fn(() => Promise.resolve([])),
    fetchUsage: vi.fn(() => Promise.resolve({ kind: 'unsupported' as const })),
    beginModelPicker: vi.fn((_picked, onAdopt) => { adopt = onAdopt }),
    completeModelPicker: vi.fn(candidates => { adopt?.(candidates) }),
    failModelPicker: vi.fn(),
    closeModelPicker: vi.fn(),
    ...overrides,
  } as OpenCodeGoPluginCardProps
}

describe('OpenCodeGoPluginCard', () => {
  it('stays visible in a remote browser and explains non-loopback settings persistence', () => {
    const current = snapshot({
      status: 'unavailable',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
      mode: 'memory',
    })
    render(<OpenCodeGoPluginCard {...props({ useOpenCodeGoSettings: selector => selector(current) })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    expect(screen.getByRole('status').textContent).toBe(en.remoteAccess)
  })

  it('paints cached weekly remaining before the usage RPC returns', async () => {
    const { persistOpenCodeGoUsage } = await import('../src/client/usage-reader.ts')
    persistOpenCodeGoUsage({ fetchedAt: '2026-08-16T00:00:00.000Z', weekly: { usage: 0.18, models: [] } })
    let resolveRead: ((value: { kind: 'ok', usage: { fetchedAt: string, weekly: { usage: number, models: never[] } } }) => void) | undefined
    const fetchUsage = vi.fn(() => new Promise<{ kind: 'ok', usage: { fetchedAt: string, weekly: { usage: number, models: never[] } } }>((resolve) => {
      resolveRead = resolve
    }))
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
      fetchUsage,
    })} />)
    expect(screen.getByRole('meter', { name: en.usageWeekly }).getAttribute('aria-valuenow')).toBe('82')
    resolveRead?.({ kind: 'ok', usage: { fetchedAt: '2026-08-16T00:00:00.000Z', weekly: { usage: 0.18, models: [] } } })
    await waitFor(() => { expect(fetchUsage).toHaveBeenCalled() })
  })

  it('fetches usage while collapsed once a key is stored', async () => {
    const fetchUsage = vi.fn(() => Promise.resolve({
      kind: 'ok' as const,
      usage: { fetchedAt: '2026-08-16T00:00:00.000Z', weekly: { usage: 0.18, models: [] } },
    }))
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
      fetchUsage,
    })} />)

    await waitFor(() => { expect(fetchUsage).toHaveBeenCalled() })
    expect(screen.getByRole('meter', { name: en.usageWeekly }).getAttribute('aria-valuenow')).toBe('82')
  })

  it('headlines monthly remaining when every window is present', async () => {
    const fetchUsage = vi.fn(() => Promise.resolve({
      kind: 'ok' as const,
      usage: {
        fetchedAt: '2026-08-16T00:00:00.000Z',
        session: { usage: 0.04, models: [] },
        weekly: { usage: 0.3, models: [] },
        monthly: { usage: 0.01, models: [] },
      },
    }))
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
      fetchUsage,
    })} />)

    await waitFor(() => {
      expect(screen.getByRole('meter', { name: en.usageMonthly }).getAttribute('aria-valuenow')).toBe('99')
    })
    expect(screen.queryByRole('meter', { name: en.usageSession })).toBeNull()
    expect(screen.queryByRole('meter', { name: en.usageWeekly })).toBeNull()
  })

  it('does not fetch usage until a key is stored', () => {
    const fetchUsage = vi.fn()
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    expect(screen.getByText(en.usageIdle)).toBeTruthy()
    expect(fetchUsage).not.toHaveBeenCalled()
  })

  it('keeps global request defaults out of the plugin editor', () => {
    render(<OpenCodeGoPluginCard {...props()} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    expect(screen.queryByText('Request defaults')).toBeNull()
    expect(screen.queryByLabelText('Stream idle timeout (ms)')).toBeNull()
    const save = screen.getByRole<HTMLButtonElement>('button', { name: en.save })
    expect(save.style.color).toBe('var(--dsw-alias-label-primary-foreground)')
    expect(save.style.background).toBe('var(--dsw-alias-button-primary-fill)')
  })

  it('opens the picker before discovery settles', async () => {
    let resolveDiscovery: ((models: readonly OpenCodeGoCatalogModelConfig[]) => void) | undefined
    const discoverModels = vi.fn(() => new Promise<readonly OpenCodeGoCatalogModelConfig[]>(resolve => {
      resolveDiscovery = resolve
    }))
    const beginModelPicker = vi.fn()
    const completeModelPicker = vi.fn()
    render(<OpenCodeGoPluginCard {...props({ discoverModels, beginModelPicker, completeModelPicker })} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    fireEvent.click(screen.getByRole('button', { name: en.fetchModels }))

    expect(beginModelPicker).toHaveBeenCalledTimes(1)
    expect(completeModelPicker).not.toHaveBeenCalled()
    resolveDiscovery?.([{ id: 'gemma3' }])
    await waitFor(() => { expect(completeModelPicker).toHaveBeenCalledWith([{ id: 'gemma3' }]) })
  })

  it('stores an API key and adopts native model capabilities from discovery', async () => {
    const saveConfiguration = vi.fn((next: OpenCodeGoSettingsView, sourceRevision: number) => Promise.resolve({ settings: next, revision: sourceRevision + 1 }))
    const storeApiKey = vi.fn(() => Promise.resolve())
    const discoverModels = vi.fn(() => Promise.resolve([
      {
        id: 'gemma3',
        name: 'Gemma 3',
        contextWindow: 131_072,
        vision: true,
        thinking: false,
        tools: true,
      },
    ]))
    render(<OpenCodeGoPluginCard {...props({ saveConfiguration, storeApiKey, discoverModels })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.change(screen.getByLabelText(en.apiKey), { target: { value: ' opencode-go-secret ' } })
    expect(screen.getByText(en.apiKeyPending)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.fetchModels }))

    await waitFor(() => { expect(storeApiKey).toHaveBeenCalledWith('opencode-go-secret') })
    await waitFor(() => { expect(discoverModels).toHaveBeenCalledWith({
      baseURL: 'https://opencode.ai/zen/go/v1',
    }) })
    fireEvent.click(await screen.findByRole('button', { name: `${en.modelDetails}: gemma3` }))
    await waitFor(() => { expect(screen.getByLabelText<HTMLInputElement>(en.vision).checked).toBe(true) })
    expect(screen.queryByLabelText(en.tools)).toBeNull()
    expect(screen.queryByLabelText(en.modelOutput)).toBeNull()
    expect(screen.getByLabelText<HTMLInputElement>(en.thinking).checked).toBe(false)
    expect(screen.getByLabelText(en.modelContext)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    expect(saveConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [{
          id: 'gemma3',
          name: 'Gemma 3',
          contextWindow: 131_072,
          vision: true,
          thinking: false,
        }],
      }),
      1,
      'opencode-go-secret',
    )
  })

  it('seeds selection from current models and replaces the catalog on adoption', async () => {
    const currentModels: OpenCodeGoCatalogModelConfig[] = [
      { id: 'keep', name: 'Keep', contextWindow: 4096 },
      { id: 'remove', name: 'Remove' },
    ]
    const current = { ...settings, models: currentModels }
    const currentSnapshot = snapshot({ value: current, base: current, user: { models: currentModels } })
    let adopt: ((models: readonly OpenCodeGoCatalogModelConfig[]) => void) | undefined
    const beginModelPicker = vi.fn((_picked: ReadonlySet<string>, onAdopt: (models: readonly OpenCodeGoCatalogModelConfig[]) => void) => {
      adopt = onAdopt
    })
    const completeModelPicker = vi.fn()
    const discoverModels = vi.fn(() => Promise.resolve([
      { id: 'keep', name: 'Keep discovered', contextWindow: 8192 },
      { id: 'new', name: 'New', contextWindow: 16384 },
    ]))
    const saveConfiguration = vi.fn(async (next: OpenCodeGoSettingsView, sourceRevision: number) => ({ settings: next, revision: sourceRevision + 1 }))
    render(<OpenCodeGoPluginCard {...props({
      useOpenCodeGoSettings: selector => selector(currentSnapshot),
      beginModelPicker,
      completeModelPicker,
      discoverModels,
      saveConfiguration,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.click(screen.getByRole('button', { name: en.fetchModels }))

    await waitFor(() => { expect(completeModelPicker).toHaveBeenCalledWith([
      { id: 'keep', name: 'Keep discovered', contextWindow: 8192 },
      { id: 'new', name: 'New', contextWindow: 16384 },
      { id: 'remove', name: 'Remove' },
    ]) })
    expect(beginModelPicker).toHaveBeenCalledWith(new Set(['keep', 'remove']), expect.any(Function))
    adopt?.([{ id: 'new', name: 'New', contextWindow: 16384 }])
    await waitFor(() => { expect(screen.getByLabelText<HTMLInputElement>(`${en.modelId} 1`).value).toBe('new') })

    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      models: [{ id: 'new', name: 'New', contextWindow: 16384 }],
    }), 1, undefined)
  })
  it('treats a base-URL-only user layer as an inherited model catalog', () => {
    const current = snapshot({ user: { baseURL: 'https://example.test/api' } })
    render(<OpenCodeGoPluginCard {...props({ useOpenCodeGoSettings: selector => selector(current) })} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    expect(screen.getByText(en.inherited)).toBeTruthy()
    expect(screen.queryByText(en.customized)).toBeNull()
  })

  it('reloads the accepted model catalog after the card remounts', async () => {
    let durable = structuredClone(settings)
    const saveConfiguration = vi.fn(async (next: OpenCodeGoSettingsView, sourceRevision: number) => {
      durable = structuredClone(next)
      return { settings: structuredClone(durable), revision: sourceRevision + 1 }
    })
    const first = render(<OpenCodeGoPluginCard {...props({
      saveConfiguration,
      discoverModels: vi.fn(() => Promise.resolve([{ id: 'qwen3', name: 'Qwen 3', thinking: true }])),
    })} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.click(screen.getByRole('button', { name: en.fetchModels }))
    fireEvent.click(await screen.findByRole('button', { name: `${en.modelDetails}: qwen3` }))
    await waitFor(() => { expect(screen.getByLabelText<HTMLInputElement>(en.thinking).checked).toBe(true) })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    first.unmount()

    const reopened = snapshot({ value: durable, user: { models: durable.models }, revision: 2 })
    render(<OpenCodeGoPluginCard {...props({ useOpenCodeGoSettings: selector => selector(reopened) })} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.click(screen.getByRole('button', { name: en.models }))

    expect(screen.getByLabelText<HTMLInputElement>(`${en.modelId} 1`).value).toBe('qwen3')
    expect(screen.getByText(en.customized)).toBeTruthy()
  })

  it('disables durable settings writes for a read-only profile', () => {
    const current = snapshot({ writable: false })
    render(<OpenCodeGoPluginCard {...props({
      useOpenCodeGoSettings: selector => selector(current),
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    expect(screen.getByLabelText<HTMLInputElement>(en.baseURL).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
    expect(screen.getByText(en.readOnly)).toBeTruthy()
  })

  it('renders cloud usage windows and per-model weekly counts', async () => {
    const fetchUsage = vi.fn(() => Promise.resolve({
      kind: 'ok' as const,
      usage: {
        fetchedAt: '2026-08-16T00:00:00.000Z',
        session: {
          usage: 0.188,
          models: [
            { name: 'session-alpha', requestCount: 75 },
            { name: 'session-beta', requestCount: 25 },
          ],
        },
        weekly: {
          usage: 0.891,
          resetsAt: '2099-09-14T00:00:00.000Z',
          models: [
            { name: 'glm-5.2', requestCount: 4133 },
            { name: 'web search', requestCount: 264 },
          ],
        },
      },
    }))
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
      fetchUsage,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getAllByText('10.9%').length).toBeGreaterThan(0) })
    expect(screen.getByText('LLM')).toBeTruthy()
    expect(screen.getAllByRole('meter', { name: en.usageWeekly })[0]?.getAttribute('aria-valuenow')).toBe('10.9')
    expect(screen.getByText('81.2%')).toBeTruthy()
    expect(screen.queryByText(/重置/u)).toBeNull()
    expect(screen.getAllByText(/Usage limits reset on/u).length).toBeGreaterThan(0)
    expect(screen.getByText(en.usageModels)).toBeTruthy()
    expect(screen.getByText('glm-5.2')).toBeTruthy()
    expect(screen.getByText(`4133 ${en.usageRequests}`)).toBeTruthy()
    expect(screen.getByText(`264 ${en.usageRequests}`)).toBeTruthy()
    expect(fetchUsage).toHaveBeenCalledWith({ baseURL: 'https://opencode.ai/zen/go/v1' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    const details = screen.getByRole('list', { name: en.usageModels })
    expect(details.style.maxHeight).toBe('')
    expect(details.style.overflowY).toBe('')
  })

  it('explains when the endpoint has no usage surface', async () => {
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getByText(en.usageUnsupported)).toBeTruthy() })
  })

  it('shows a usage read failure and retries on demand', async () => {
    const fetchUsage = vi.fn()
      .mockRejectedValueOnce(new Error('could not reach https://opencode.ai/zen/go/v1/usage'))
      .mockResolvedValueOnce({
        kind: 'ok' as const,
        usage: { fetchedAt: '2026-08-16T00:00:00.000Z', weekly: { usage: 0.1, models: [] } },
      })
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
      fetchUsage,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getByText(en.usageUnreachable)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.usageRefresh }))
    await waitFor(() => { expect(screen.getAllByText('90%').length).toBeGreaterThan(0) })
    expect(fetchUsage).toHaveBeenCalledTimes(2)
  })

  it('asks for a host restart when the running plugin predates usage reads', async () => {
    const fetchUsage = vi.fn(() => Promise.resolve({ kind: 'needs-restart' as const }))
    render(<OpenCodeGoPluginCard {...props({
      describeCredential: vi.fn(() => Promise.resolve({ configured: true, writable: true })),
      fetchUsage,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getByText(en.usageNeedsRestart)).toBeTruthy() })
  })

  it('reorders catalog rows by dragging the handle', async () => {
    const currentModels: OpenCodeGoCatalogModelConfig[] = [{ id: 'alpha' }, { id: 'bravo' }, { id: 'charlie' }]
    const current = { ...settings, models: currentModels }
    const currentSnapshot = snapshot({ value: current, base: current, user: { models: currentModels } })
    const saveConfiguration = vi.fn(async (next: OpenCodeGoSettingsView, sourceRevision: number) => ({ settings: next, revision: sourceRevision + 1 }))
    const { container } = render(<OpenCodeGoPluginCard {...props({
      useOpenCodeGoSettings: selector => selector(currentSnapshot),
      saveConfiguration,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.click(screen.getByRole('button', { name: en.models }))

    const listRows = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('[data-model-row]'))
      .filter(row => row.closest('[data-sortable-ghost]') === null)
    const rows = listRows()
    for (const [index, row] of rows.entries()) {
      const sortable = row.closest<HTMLElement>('[data-sortable-row]') ?? row
      vi.spyOn(sortable, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: index * 50, top: index * 50, bottom: index * 50 + 40,
        left: 0, right: 400, width: 400, height: 40, toJSON: () => ({}),
      })
    }

    fireEvent.pointerDown(screen.getByLabelText(`${en.dragModel}: alpha`), {
      button: 0, pointerId: 1, clientX: 10, clientY: 10,
    })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 140 })

    // The preview order changes before release: sibling cards move out of the
    // way while a floating ghost follows the pointer.
    expect(listRows().map(row => row.getAttribute('data-model-row'))).toEqual([
      'bravo', 'charlie', 'alpha',
    ])
    expect(document.querySelector('[data-sortable-ghost="true"]')).not.toBeNull()

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 140 })

    // After release the preview order is the committed one and the floating
    // ghost is gone, so it can never be mistaken for a list row again.
    expect(listRows().map(row => row.getAttribute('data-model-row'))).toEqual([
      'bravo', 'charlie', 'alpha',
    ])
    expect(document.querySelector('[data-sortable-ghost="true"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      models: [{ id: 'bravo' }, { id: 'charlie' }, { id: 'alpha' }],
    }), 1, undefined)
  })

  it('accepts K/M context window spellings', async () => {
    const saveConfiguration = vi.fn((next: OpenCodeGoSettingsView, sourceRevision: number) => Promise.resolve({ settings: next, revision: sourceRevision + 1 }))
    render(<OpenCodeGoPluginCard {...props({ saveConfiguration })} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.click(screen.getByRole('button', { name: en.models }))
    fireEvent.click(screen.getByRole('button', { name: en.addModel }))
    fireEvent.change(screen.getByLabelText(`${en.modelId} 1`), { target: { value: 'omen' } })
    fireEvent.change(screen.getByLabelText(en.modelContext), { target: { value: '1m' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      models: [expect.objectContaining({ id: 'omen', contextWindow: 1_000_000 })],
    }), 1, undefined)
  })
  it('renders the shared detail template when the settings page asks for it', () => {
    const onRefresh = vi.fn()
    const usage = {
      status: 'ready' as const,
      fetchedAt: '2026-09-12T00:00:00.000Z',
      windows: [
        { id: 'session', label: 'Session', shortLabel: 'S', remainingPercent: 98, valueText: '98%' },
        { id: 'weekly', label: 'Week', shortLabel: 'W', remainingPercent: 68, valueText: '68%' },
      ],
    }
    const withModels = {
      ...settings,
      models: [
        { id: 'alpha', contextWindow: 200_000 },
        { id: 'beta', contextWindow: 200_000 },
      ],
    }
    const current = snapshot({ value: withModels, base: withModels, user: {} })
    const { container } = render(<OpenCodeGoPluginCard {...props({
      useOpenCodeGoSettings: selector => selector(current),
      mode: 'detail',
      usage,
      accountState: 'configured',
      onRefresh,
      copy: providerDetailCopy.en,
      template: ProviderDetail,
    })} />)

    expect(container.querySelector('[data-provider-detail]')).not.toBeNull()
    expect(container.querySelector('[data-c-quota]')).not.toBeNull()
    // Both windows survive: the detail is not limited to the headline window.
    expect(container.textContent).toContain('98%')
    expect(container.textContent).toContain('68%')
    expect(container.textContent).toContain('2 models')
    expect(container.querySelector('[data-provider-models] .c-count')?.textContent).toBe('2')
    // The plugin's own usage section is gone; only the shared quota block remains.
    expect(container.querySelector('[aria-label="' + en.usage + '"]')).toBeNull()
    expect(container.querySelectorAll('[data-c-quota]')).toHaveLength(1)
  })
})
