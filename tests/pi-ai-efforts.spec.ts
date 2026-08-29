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
  it('declares muse levels up to xhigh only, never max', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([{ id: 'muse-spark-1.2-contributor', thinking: true }]))
    const model = modelsOf(profile).find(entry => entry.id === 'muse-spark-1.2-contributor')
    expect(model?.reasoningEfforts).toBeDefined()
    expect(Object.keys(model?.reasoningEfforts ?? {})).not.toContain('max')
    expect(Object.keys(model?.reasoningEfforts ?? {})).toEqual(expect.arrayContaining(['minimal', 'low', 'medium', 'high', 'xhigh']))
  })

  it('declares gpt levels including max', () => {
    const profile = createOpenCodeGoPiAiProfile(connection([{ id: 'gpt-5.6-luna', thinking: true }]))
    const model = modelsOf(profile).find(entry => entry.id === 'gpt-5.6-luna')
    expect(Object.keys(model?.reasoningEfforts ?? {})).toContain('max')
  })
})
