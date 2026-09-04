import { unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverModels, parseOpenCodeGoModels } from '../src/discovery.ts'
import { protocolForModel } from '../src/catalog.ts'
import {
  clearOpenCodeGoModelsDevCache,
  loadOpenCodeGoModelsDev,
  MODELS_DEV_URL,
  parseOpenCodeGoModelsDev,
  setOpenCodeGoModelsDevCachePathForTests,
} from '../src/models-dev.ts'

afterEach(() => {
  vi.restoreAllMocks()
  clearOpenCodeGoModelsDevCache()
  setOpenCodeGoModelsDevCachePathForTests(undefined)
})

describe('OpenCode Go model discovery', () => {
  it('enriches listing ids with documented protocol and context', () => {
    const models = parseOpenCodeGoModels({
      object: 'list',
      data: [
        { id: 'grok-4.6' },
        { id: 'glm-5.3-flash' },
        { id: 'minimax-m3' },
        { id: 'qwen3.8-max' },
        { id: 'unknown-model' },
      ],
    })
    expect(models.map(model => [model.id, model.api, model.contextWindow])).toEqual([
      ['grok-4.6', 'openai-responses', 500_000],
      ['glm-5.3-flash', 'openai-completions', 1_000_000],
      ['minimax-m3', 'anthropic-messages', 1_000_000],
      ['qwen3.8-max', 'anthropic-messages', 1_000_000],
      ['unknown-model', 'openai-completions', undefined],
    ])
    expect(protocolForModel('gpt-5.6-luna')).toBe('openai-responses')
  })

  it('prefers live context_length when the listing supplies one', () => {
    const models = parseOpenCodeGoModels({ data: [{ id: 'glm-5.3', context_length: 202752 }] })
    expect(models[0]?.contextWindow).toBe(202752)
  })

  it('enriches newly published models and corrects current capability metadata', () => {
    const models = parseOpenCodeGoModels({
      data: [
        { id: 'hy4-preview' },
        { id: 'qwen3.8-flash' },
        { id: 'muse-spark-1.3-contributor' },
        { id: 'glm-5.3-flash' },
        { id: 'minimax-m2.5' },
        { id: 'qwen3.5-plus' },
        { id: 'omen-alpha' },
      ],
    })
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hy4-preview',
        contextWindow: 1_024_000,
        maxTokens: 64_000,
        vision: false,
        thinking: true,
        defaultEffort: 'high',
        api: 'openai-completions',
      }),
      expect.objectContaining({
        id: 'qwen3.8-flash',
        contextWindow: 1_000_000,
        maxTokens: 131_072,
        vision: true,
        thinking: true,
        defaultEffort: 'xhigh',
        api: 'anthropic-messages',
      }),
      expect.objectContaining({
        id: 'muse-spark-1.3-contributor',
        contextWindow: 1_048_576,
        maxTokens: 131_072,
        vision: true,
        thinking: true,
        defaultEffort: 'max',
        api: 'openai-responses',
      }),
      expect.objectContaining({ id: 'glm-5.3-flash', vision: true }),
      expect.objectContaining({ id: 'minimax-m2.5', contextWindow: 204_800 }),
      expect.objectContaining({ id: 'qwen3.5-plus', contextWindow: 262_144 }),
      expect.objectContaining({
        id: 'omen-alpha',
        name: 'Omen Alpha',
        contextWindow: 500_000,
        maxTokens: 128_000,
        vision: true,
        thinking: true,
        defaultEffort: 'high',
        api: 'openai-completions',
      }),
    ]))
  })

  it('fills unknown ids from a models.dev overlay without inventing a window', () => {
    const overlay = parseOpenCodeGoModelsDev({
      'opencode-go': {
        models: {
          'brand-new': {
            id: 'brand-new',
            name: 'Brand New',
            attachment: true,
            reasoning: true,
            reasoning_options: [{ type: 'effort', values: ['low', 'high'] }],
            limit: { context: 32_000, output: 8_192 },
            modalities: { input: ['text', 'image'] },
          },
        },
      },
    })
    const models = parseOpenCodeGoModels({
      data: [{ id: 'brand-new' }, { id: 'still-unknown' }],
    }, overlay)
    expect(models).toEqual([
      expect.objectContaining({
        id: 'brand-new',
        name: 'Brand New',
        contextWindow: 32_000,
        maxTokens: 8_192,
        vision: true,
        thinking: true,
        defaultEffort: 'high',
        thinkingEfforts: ['low', 'high'],
      }),
      expect.objectContaining({ id: 'still-unknown', api: 'openai-completions', thinking: false }),
    ])
    expect(models[1]?.contextWindow).toBeUndefined()
  })

  it('does not treat models.dev attachment as vision without image input', () => {
    const overlay = parseOpenCodeGoModelsDev({
      'opencode-go': {
        models: {
          'text-only': {
            id: 'text-only',
            attachment: true,
            reasoning: false,
            limit: { context: 1000, output: 100 },
            modalities: { input: ['text'] },
          },
        },
      },
    })
    const models = parseOpenCodeGoModels({ data: [{ id: 'text-only' }] }, overlay)
    expect(models[0]).toMatchObject({ id: 'text-only', vision: false, contextWindow: 1000 })
  })

  it('does not let a models.dev row without vision/reasoning keys clobber the snapshot', () => {
    const overlay = parseOpenCodeGoModelsDev({
      'opencode-go': {
        models: {
          'glm-5.3-flash': {
            id: 'glm-5.3-flash',
            limit: { context: 1_000_000, output: 131_072 },
          },
        },
      },
    })
    const models = parseOpenCodeGoModels({ data: [{ id: 'glm-5.3-flash' }] }, overlay)
    expect(models[0]).toMatchObject({
      id: 'glm-5.3-flash',
      vision: true,
      thinking: true,
      contextWindow: 1_000_000,
    })
  })

  it('fetches the public listing without transporting a credential', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === MODELS_DEV_URL) return new Response(JSON.stringify({ 'opencode-go': { models: {} } }), { status: 200 })
      expect(url).toBe('https://example.test/zen/go/v1/models')
      expect(new Headers(init?.headers).get('authorization')).toBeNull()
      return new Response(JSON.stringify({ data: [{ id: 'kimi-k3' }] }), { status: 200 })
    })
    const result = await discoverModels({ baseURL: 'https://example.test/zen/go/v1/' }, undefined, fetchImpl)
    expect(result[0]).toMatchObject({ id: 'kimi-k3', api: 'openai-completions', vision: true })
  })

  it('merges models.dev capacities for ids the local snapshot does not know', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === MODELS_DEV_URL) {
        return new Response(JSON.stringify({
          'opencode-go': {
            models: {
              'brand-new': {
                id: 'brand-new',
                name: 'Brand New',
                attachment: true,
                reasoning: true,
                reasoning_options: [{ type: 'effort', values: ['low', 'high'] }],
                limit: { context: 99_000, output: 4_000 },
                modalities: { input: ['text', 'image'] },
              },
            },
          },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [{ id: 'brand-new' }] }), { status: 200 })
    })
    const result = await discoverModels({ baseURL: 'https://example.test/zen/go/v1' }, undefined, fetchImpl)
    expect(result[0]).toMatchObject({
      id: 'brand-new',
      name: 'Brand New',
      contextWindow: 99_000,
      maxTokens: 4_000,
      vision: true,
      thinking: true,
      defaultEffort: 'high',
      thinkingEfforts: ['low', 'high'],
    })
  })

  it('reuses a warm models.dev overlay without a second download', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      'opencode-go': { models: { 'brand-new': { id: 'brand-new', limit: { context: 1_000, output: 100 } } } },
    }), { status: 200 }))
    await loadOpenCodeGoModelsDev(fetchImpl)
    await loadOpenCodeGoModelsDev(fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reuses a disk overlay without a second download', async () => {
    const file = join(tmpdir(), `ocg-models-dev-${String(process.pid)}-${String(Date.now())}.json`)
    setOpenCodeGoModelsDevCachePathForTests(file)
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      'opencode-go': { models: { 'brand-new': { id: 'brand-new', limit: { context: 1_000, output: 100 } } } },
    }), { status: 200 }))
    try {
      await loadOpenCodeGoModelsDev(fetchImpl)
      clearOpenCodeGoModelsDevCache()
      setOpenCodeGoModelsDevCachePathForTests(file)
      const overlay = await loadOpenCodeGoModelsDev(fetchImpl)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(overlay.get('brand-new')?.contextWindow).toBe(1_000)
    } finally {
      try { unlinkSync(file) } catch { /* test temp */ }
    }
  })

  it('does not stall Fetch when models.dev is slow', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === MODELS_DEV_URL) return await new Promise<Response>(() => undefined)
      return new Response(JSON.stringify({ data: [{ id: 'kimi-k3' }] }), { status: 200 })
    })
    const started = Date.now()
    const result = await discoverModels({ baseURL: 'https://example.test/zen/go/v1' }, undefined, fetchImpl)
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(result[0]).toMatchObject({ id: 'kimi-k3' })
  })

  it('aborts a response-body read when the caller signal aborts', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(async () => new Response(new ReadableStream({
      start(stream) { stream.enqueue(new TextEncoder().encode('{')) },
    }), { status: 200 }))
    const pending = discoverModels({ baseURL: 'https://example.test/zen/go/v1' }, undefined, fetchImpl, controller.signal)
    await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' })
  })

  it('maps the response-body timeout to a discovery failure', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    const fetchImpl = vi.fn(async () => new Response(new ReadableStream({
      start(stream) { stream.enqueue(new TextEncoder().encode('{')) },
    }), { status: 200 }))
    const pending = discoverModels({ baseURL: 'https://example.test/zen/go/v1' }, undefined, fetchImpl)
    await Promise.resolve()
    timeout.abort()
    await expect(pending).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
  })
})
