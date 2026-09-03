import { describe, expect, it } from 'vitest'
import type { OpenCodeGoCatalogModel } from '../src/adapter.ts'
import { createOpenCodeGoPiAiProfile } from '../src/pi-ai-profile.ts'

function connection(models: Array<{ id: string; thinking?: boolean }>): Parameters<typeof createOpenCodeGoPiAiProfile>[0] {
  return {
    baseURL: 'https://opencode.test',
    defaultContextWindow: 131_072,
    models: models.map(model => ({ thinking: true, ...model })) as OpenCodeGoCatalogModel[],
  }
}

function modelsOf(profile: ReturnType<typeof createOpenCodeGoPiAiProfile>): Array<{ id: string; reasoningEfforts?: Record<string, string | null> }> {
  const provider = profile.piProvider as unknown as { getModels?: () => Array<{ id: string; reasoningEfforts?: Record<string, string | null> }> }
  return provider.getModels?.() ?? []
}

describe('OpenCode Go pi-ai reasoningEfforts metadata', () => {
  it('keeps Muse Spark 1.2 capped at xhigh while exposing forward max for 1.3 contributor', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([{ id: 'muse-spark-1.2-contributor', thinking: true }]))
    const model = modelsOf(profile).find(entry => entry.id === 'muse-spark-1.2-contributor')
    expect(model?.reasoningEfforts).toBeDefined()
    expect(Object.keys(model?.reasoningEfforts ?? {})).not.toContain('max')
    expect(Object.keys(model?.reasoningEfforts ?? {})).toEqual(expect.arrayContaining(['minimal', 'low', 'medium', 'high', 'xhigh']))

    const nextProfile = createOpenCodeGoPiAiProfile(connection([{ id: 'muse-spark-1.3-contributor', thinking: true }]))
    const nextModel = modelsOf(nextProfile).find(entry => entry.id === 'muse-spark-1.3-contributor')
    expect(Object.keys(nextModel?.reasoningEfforts ?? {})).toEqual(expect.arrayContaining(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']))
  })

  it('uses model-specific effort sets for Hy4 and Qwen3.8 Flash', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([
      { id: 'hy4-preview', thinking: true },
      { id: 'qwen3.8-flash', thinking: true },
    ]))
    const models = modelsOf(profile)
    expect(Object.keys(models.find(entry => entry.id === 'hy4-preview')?.reasoningEfforts ?? {})).toEqual(expect.arrayContaining(['off', 'high']))
    expect(Object.keys(models.find(entry => entry.id === 'qwen3.8-flash')?.reasoningEfforts ?? {})).toEqual(['low', 'medium', 'xhigh'])
  })

  it('declares gpt levels including max', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([{ id: 'gpt-5.6-luna', thinking: true }]))
    const model = modelsOf(profile).find(entry => entry.id === 'gpt-5.6-luna')
    expect(Object.keys(model?.reasoningEfforts ?? {})).toContain('max')
  })

  it('freezes existing GPT and Grok effort sets and defaults', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([
      { id: 'gpt-5.6-sol', thinking: true },
      { id: 'gpt-5.5', thinking: true },
      { id: 'gpt-5.4-mini', thinking: true },
      { id: 'grok-4.5', thinking: true },
      { id: 'grok-4.6', thinking: true },
    ]))
    const models = modelsOf(profile)
    expect(Object.keys(models.find(entry => entry.id === 'gpt-5.6-sol')?.reasoningEfforts ?? {})).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(Object.keys(models.find(entry => entry.id === 'gpt-5.5')?.reasoningEfforts ?? {})).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(Object.keys(models.find(entry => entry.id === 'gpt-5.4-mini')?.reasoningEfforts ?? {})).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(Object.keys(models.find(entry => entry.id === 'grok-4.5')?.reasoningEfforts ?? {})).toEqual(['low', 'medium', 'high'])
    expect(Object.keys(models.find(entry => entry.id === 'grok-4.6')?.reasoningEfforts ?? {})).toEqual(['low', 'medium', 'high'])
  })
})
