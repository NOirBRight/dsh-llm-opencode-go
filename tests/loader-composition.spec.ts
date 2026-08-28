import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialRecord } from '@deepseek-ai/dsh-credentials'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as OpenCodeGo from '../src/index.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, openAITextEvents } from './mock-server.ts'

let root: string | undefined
let context: Context | undefined
const OPENCODE_GO_CREDENTIAL_KEY = credentialKey('llm-opencode-go', 'opencode-go')

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  await closeMockServers()
  vi.unstubAllEnvs()
})

async function loadComposition(baseURL: string, storedCredential?: CredentialRecord): Promise<Context> {
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
  if (storedCredential !== undefined) {
    const records = new Map([[OPENCODE_GO_CREDENTIAL_KEY, storedCredential]])
    ctx.provide('credentials', {
      readRecord: async (key: typeof OPENCODE_GO_CREDENTIAL_KEY) => records.get(key),
      describeRecord: async (key: typeof OPENCODE_GO_CREDENTIAL_KEY) => {
        const record = records.get(key)
        return record === undefined
          ? { configured: false, writable: true }
          : { configured: true, kind: record.kind, writable: true }
      },
      modifyRecord: async (key: typeof OPENCODE_GO_CREDENTIAL_KEY, mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) => {
        const next = await mutate(records.get(key))
        if (next === undefined) records.delete(key)
        else records.set(key, next)
        return next
      },
      deleteRecord: async (key: typeof OPENCODE_GO_CREDENTIAL_KEY) => { records.delete(key) },
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
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url, { kind: 'api-key', key: 'isolated-test-key' })
    expect(ctx.llm.listProviders().map(provider => provider.id)).toEqual(['opencode-go'])
    const models = await ctx.llm.listModels('opencode-go')
    expect(models.map(model => model.id)).toEqual(['glm-5.3'])
    const info = await ctx.llm.resolveModelInfo('opencode-go', 'glm-5.3')
    expect(info.context?.contextWindow).toBe(1_000_000)
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toEqual({ kind: 'stop' })
    expect(server.headers[0]?.authorization).toBe('Bearer isolated-test-key')
  })

  it('ignores ambient API keys outside its credential record', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'dsh-ambient-key')
    vi.stubEnv('OPENCODE_API_KEY', 'opencode-ambient-key')
    vi.stubEnv('OPENCODE_GO_API_KEY', 'opencode-go-ambient-key')
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url)
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
    expect(server.headers).toHaveLength(0)
  })

  it('fails with MISSING_CREDENTIAL when no key is available', async () => {
    const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
    const ctx = await loadComposition(server.url)
    expect(ctx.llm.listProviders().map(provider => provider.id)).toEqual(['opencode-go'])
    const result = await assemble(ctx, { model: 'glm-5.3', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
  })
})
