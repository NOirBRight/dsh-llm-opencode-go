// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { OpenCodeGoPluginCard } from '../src/client/OpenCodeGoPluginCard.tsx'
import type { OpenCodeGoPluginCardProps } from '../src/client/OpenCodeGoPluginCard.tsx'
import { en } from '../src/client/locales.ts'
import type { OpenCodeGoCatalogModelConfig, OpenCodeGoSettingsView } from '../src/client-contract.ts'

afterEach(() => { cleanup() })

const settings: OpenCodeGoSettingsView = {
  apiKeyEnv: 'OPENCODE_GO_API_KEY',
  baseURL: 'https://opencode.ai/zen/go/v1',
  models: [],
  defaultContextWindow: 4096,
  streamIdleTimeoutMs: 300_000,
}

function snapshot(overrides: Partial<SettingsScopeSnapshot<OpenCodeGoSettingsView>> = {}): SettingsScopeSnapshot<OpenCodeGoSettingsView> {
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
    saveConfiguration: vi.fn(next => Promise.resolve({ settings: next, revision: 2 })),
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
  it('stays visible in a remote browser and explains the loopback-only configuration plane', () => {
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
    const saveConfiguration = vi.fn((next: OpenCodeGoSettingsView) => Promise.resolve({ settings: next, revision: 2 }))
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
    const saveConfiguration = vi.fn(async (next: OpenCodeGoSettingsView) => ({ settings: next, revision: 2 }))
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
    }), undefined)
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
    const saveConfiguration = vi.fn(async (next: OpenCodeGoSettingsView) => {
      durable = structuredClone(next)
      return { settings: structuredClone(durable), revision: 2 }
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
          models: [
            { name: 'glm-5.2', requestCount: 4133 },
            { name: 'web search', requestCount: 264 },
          ],
        },
      },
    }))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getByText(`${en.usageUsed} 89.1%`)).toBeTruthy() })
    expect(screen.getByText(`${en.usageUsed} 18.8%`)).toBeTruthy()
    expect(screen.getByText(en.usageModels)).toBeTruthy()
    expect(screen.getByText('glm-5.2')).toBeTruthy()
    expect(screen.getByText(`4133 ${en.usageRequests}`)).toBeTruthy()
    expect(screen.getByText(`264 ${en.usageRequests}`)).toBeTruthy()
    expect(fetchUsage).toHaveBeenCalledWith({ baseURL: 'https://opencode.ai/zen/go/v1' })
    expect(screen.getByRole('progressbar', { name: en.usageWeekly }).getAttribute('aria-valuenow')).toBe('89')

    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.getByRole('progressbar', { name: en.usageSession }).querySelectorAll('[data-usage-segment]')).toHaveLength(0)

    const details = screen.getByRole('list', { name: en.usageModels })
    expect(details.style.maxHeight).toBe('')
    expect(details.style.overflowY).toBe('')
  })

  it('explains when the endpoint has no usage surface', async () => {
    render(<OpenCodeGoPluginCard {...props()} />)

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
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getByText(en.usageUnreachable)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.usageRefresh }))
    await waitFor(() => { expect(screen.getByText(`${en.usageUsed} 10%`)).toBeTruthy() })
    expect(fetchUsage).toHaveBeenCalledTimes(2)
  })

  it('asks for a host restart when the running plugin predates usage reads', async () => {
    const fetchUsage = vi.fn(() => Promise.resolve({ kind: 'needs-restart' as const }))
    render(<OpenCodeGoPluginCard {...props({ fetchUsage })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))

    await waitFor(() => { expect(screen.getByText(en.usageNeedsRestart)).toBeTruthy() })
  })

  it('reorders catalog rows by dragging the handle', async () => {
    const currentModels: OpenCodeGoCatalogModelConfig[] = [{ id: 'alpha' }, { id: 'bravo' }, { id: 'charlie' }]
    const current = { ...settings, models: currentModels }
    const currentSnapshot = snapshot({ value: current, base: current, user: { models: currentModels } })
    const saveConfiguration = vi.fn(async (next: OpenCodeGoSettingsView) => ({ settings: next, revision: 2 }))
    const { container } = render(<OpenCodeGoPluginCard {...props({
      useOpenCodeGoSettings: selector => selector(currentSnapshot),
      saveConfiguration,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.expand}: ${en.title}` }))
    fireEvent.click(screen.getByRole('button', { name: en.models }))

    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-model-row]'))
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
    expect(Array.from(container.querySelectorAll('[data-model-row]')).map(row => row.getAttribute('data-model-row'))).toEqual([
      'bravo', 'charlie', 'alpha',
    ])
    expect(document.querySelector('[data-sortable-ghost="true"]')).not.toBeNull()

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 140 })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(saveConfiguration).toHaveBeenCalledTimes(1) })
    expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      models: [{ id: 'bravo' }, { id: 'charlie' }, { id: 'alpha' }],
    }), undefined)
  })
})
