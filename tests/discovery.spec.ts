import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverModels, parseOpenCodeGoModels } from '../src/discovery.ts'
import { protocolForModel } from '../src/catalog.ts'

afterEach(() => { vi.restoreAllMocks() })

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
    ]))
  })

  it('fetches the public listing without transporting a credential', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.test/zen/go/v1/models')
      expect(new Headers(init?.headers).get('authorization')).toBeNull()
      return new Response(JSON.stringify({ data: [{ id: 'kimi-k3' }] }), { status: 200 })
    })
    const result = await discoverModels({ baseURL: 'https://example.test/zen/go/v1/' }, undefined, fetchImpl)
    expect(result[0]).toMatchObject({ id: 'kimi-k3', api: 'openai-completions', vision: true })
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
