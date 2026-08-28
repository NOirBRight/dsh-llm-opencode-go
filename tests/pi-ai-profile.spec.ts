import { describe, expect, it } from 'vitest'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { createOpenCodeGoPiAiProfile } from '../src/pi-ai-profile.ts'
import type { OpenCodeGoConnectionOptions } from '../src/adapter.ts'

function connection(models: OpenCodeGoConnectionOptions['models']): OpenCodeGoConnectionOptions {
  return {
    baseURL: 'https://opencode.ai/zen/go/v1',
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
      { id: 'muse-spark-1.2-contributor', contextWindow: 1_048_576, thinking: true, vision: true },
      { id: 'minimax-m3', contextWindow: 1_000_000, api: 'anthropic-messages' },
    ]))
    const models = profile.piProvider.getModels()
    expect(models.find(model => model.id === 'glm-5.3')?.api).toBe('openai-completions')
    expect(models.find(model => model.id === 'grok-4.6')?.api).toBe('openai-responses')
    expect(models.find(model => model.id === 'muse-spark-1.2-contributor')?.api).toBe('openai-completions')
    expect(models.find(model => model.id === 'minimax-m3')?.api).toBe('anthropic-messages')
    expect(profile.provider).toBe('opencode-go')
    expect(profile.baseURL).toBe('https://opencode.ai/zen/go/v1')
    expect(profile.headers?.['x-opencode-client']).toBe('cli')
    expect(profile.headers?.['x-opencode-session']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(profile.headers?.['x-opencode-request']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(profile.headers?.['x-opencode-session']).not.toBe(profile.headers?.['x-opencode-request'])
  })
})
