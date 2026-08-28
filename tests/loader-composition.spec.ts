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
import { closeMockServers, mockServer, openAITextEvents } from './mock-server.ts'

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

async function loadComposition(baseURL: string, storedCredentials?: Readonly<Record<string, string>>): Promise<Context> {
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
    '      - id: glm-5.3',
    '        name: GLM-5.3',
    '        contextWindow: 1000000',
    '        thinking: true',
    '',
  ].join('\n'))
  const ctx = new Context()
  context = ctx
  if (storedCredentials !== undefined) {
    const values = new Map(Object.entries(storedCredentials))
    ctx.provide('credentials', {
      resolve: async (ref: string) => {
        const value = values.get(ref)
        return value === undefined ? undefined : { value, source: 'test' }
      },
      describe: async (ref: string) => ({ configured: values.has(ref), writable: true }),
      set: async (ref: string, value: string) => { values.set(ref, value) },
      unset: async (ref: string) => { values.delete(ref) },
    } as never)
  }
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

  it('uses the legacy ambient key when the official reference is empty', async () => {
    vi.stubEnv('OPENCODE_API_KEY', '')
    vi.stubEnv('OPENCODE_GO_API_KEY', 'legacy-test-key')
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url)
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toEqual({ kind: 'stop' })
    expect(server.headers[0]?.authorization).toBe('Bearer legacy-test-key')
  })

  it('uses the legacy stored key when the official reference is empty', async () => {
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url, { OPENCODE_GO_API_KEY: 'legacy-test-key' })
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toEqual({ kind: 'stop' })
    expect(server.headers[0]?.authorization).toBe('Bearer legacy-test-key')
  })

  it('fails with MISSING_CREDENTIAL when no key is available', async () => {
    vi.stubEnv('OPENCODE_API_KEY', '')
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url)
    expect(ctx.llm.listProviders().map(provider => provider.id)).toEqual(['opencode-go'])
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
  })
})
