import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as OpenCodeGo from '../src/index.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, openAIResponsesTextEvents, openAITextEvents } from './mock-server.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  await closeMockServers()
  vi.unstubAllEnvs()
})

async function loadComposition(baseURL: string, model = 'glm-5.3'): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-llm-opencode-go-comp-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- id: llm',
    "  name: 'test-llm-service'",
    '- id: llm-opencode-go',
    "  name: 'dsh-llm-opencode-go'",
    '  config:',
    '    baseURL: ' + JSON.stringify(baseURL),
    '    models:',
    '      - id: ' + model,
    '        name: ' + model,
    '        contextWindow: 1000000',
    '        thinking: true',
    '',
  ].join('\n'))
  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['test-llm-service', LlmRuntime],
    ['dsh-llm-opencode-go', OpenCodeGo],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      const module = modules.get(specifier)
      if (module === undefined) throw new Error('unexpected Loader import: ' + specifier)
      return module
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

describe('llm-opencode-go real composition', () => {
  it('boots from cordis.yml and registers the opencode-go route', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url)
    expect(ctx.llm.listProviders().map(provider => provider.id)).toEqual(['opencode-go'])
    const models = await ctx.llm.listModels('opencode-go')
    expect(models.map(model => model.id)).toEqual(['glm-5.3'])
    const info = await ctx.llm.resolveModelInfo('opencode-go', 'glm-5.3')
    expect(info.context?.contextWindow).toBe(1_000_000)
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toEqual({ kind: 'stop' })
    expect(server.headers[0]?.authorization).toBe('Bearer test-key')
  })

  it('fails with MISSING_CREDENTIAL when no key is available', async () => {
    vi.stubEnv('OPENCODE_API_KEY', '')
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url)
    expect(ctx.llm.listProviders().map(provider => provider.id)).toEqual(['opencode-go'])
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
  })

  it('serializes forward Muse max to the Responses reasoning field', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const server = await mockServer([{ kind: 'sse', events: openAIResponsesTextEvents }])
    const ctx = await loadComposition(server.url, 'muse-spark-1.3-contributor')
    const result = await assemble(ctx, { model: 'muse-spark-1.3-contributor', messages: [], reasoningEffort: 'max' })
    expect(result.finish).toEqual({ kind: 'stop' })
    expect(server.requests[0]).toMatchObject({
      model: 'muse-spark-1.3-contributor',
      reasoning: { effort: 'max' },
    })
  })
})
