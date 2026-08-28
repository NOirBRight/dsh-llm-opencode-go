import { describe, expect, it, vi } from 'vitest'
import { discoverModels, parseOpenCodeGoModels } from '../src/discovery.ts'
import { protocolForModel } from '../src/catalog.ts'

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

  it('fetches the public listing without transporting a credential', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.test/zen/go/v1/models')
      expect(new Headers(init?.headers).get('authorization')).toBeNull()
      return new Response(JSON.stringify({ data: [{ id: 'kimi-k3' }] }), { status: 200 })
    })
    const result = await discoverModels({ baseURL: 'https://example.test/zen/go/v1/' }, undefined, fetchImpl)
    expect(result[0]).toMatchObject({ id: 'kimi-k3', api: 'openai-completions', vision: true })
  })
})
