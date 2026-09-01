import { describe, expect, it } from 'vitest'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { OpenCodeGoAdapter } from '../src/adapter.ts'
import { createOpenCodeGoPiAiProfile } from '../src/pi-ai-profile.ts'
import type { OpenCodeGoConnectionOptions } from '../src/adapter.ts'

function connection(models: OpenCodeGoConnectionOptions['models']): OpenCodeGoConnectionOptions {
  return {
    baseURL: 'https://opencode.ai/zen/go/v1',
    apiKeyEnv: credentialRef('OPENCODE_GO_API_KEY'),
    models,
    defaultContextWindow: 262_144,
    maxTokens: undefined,
    streamIdleTimeoutMs: 300_000,
    retryPolicy: resolveRetryPolicy(undefined, 'test'),
  }
}

describe('OpenCode Go pi-ai profile', () => {
  it('dispatches Completions, Responses, and Messages from one provider', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([
      { id: 'glm-5.3', contextWindow: 1_000_000 },
      { id: 'grok-4.6', contextWindow: 500_000, thinking: true, vision: true },
      { id: 'minimax-m3', contextWindow: 1_000_000, api: 'anthropic-messages' },
    ]))
    const models = profile.piProvider.getModels()
    expect(models.find(model => model.id === 'glm-5.3')?.api).toBe('openai-completions')
    expect(models.find(model => model.id === 'grok-4.6')?.api).toBe('openai-responses')
    expect(models.find(model => model.id === 'minimax-m3')?.api).toBe('anthropic-messages')
    expect(profile.provider).toBe('opencode-go')
    expect(profile.baseURL).toBe('https://opencode.ai/zen/go/v1')
  })
})

describe('OpenCodeGoAdapter image pricing', () => {
  it('declares neutral imageRequestPricing for alpha hosts', () => {
    expect(Object.hasOwn(OpenCodeGoAdapter.prototype, 'imageRequestPricing')).toBe(true)
    const adapter = new OpenCodeGoAdapter({
      options: () => connection([{ id: 'glm-5.3', contextWindow: 1_000_000 }]),
      resolveApiKey: async () => 'test-key',
    })
    expect(adapter.imageRequestPricing('opencode-go', 'glm-5.3')).toBeUndefined()
  })
})
