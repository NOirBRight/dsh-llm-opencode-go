import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as OpenCodeGo from '../src/index.ts'
import { narrowOpenCodeGoEscalationSchemas, OpenCodeGoAdapter } from '../src/adapter.ts'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { OpenCodeGoConnectionOptions } from '../src/adapter.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, openAITextEvents } from './mock-server.ts'

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

describe('narrowOpenCodeGoEscalationSchemas', () => {
  const options = (mode: string) => ({
    provider: 'opencode-go',
    model: 'glm-5.3',
    messages: [] as never[],
    system: 'Current DSH file policy: ' + mode + '.',
    tools: [
      {
        name: 'write',
        description: 'write',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
            justification: { type: 'string' },
          },
          required: ['file_path', 'sandbox_permissions', 'justification'],
        },
      },
    ],
  })

  it('offers only strictly wider modes to a workspace-write session (system)', () => {
    const original = options('workspace-write')
    const narrowed = narrowOpenCodeGoEscalationSchemas(original as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
    expect((narrowed.tools?.[0]?.parameters as any).properties.justification).toBeDefined()
    expect((original.tools[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['workspace-write', 'danger-full-access'])
    expect(narrowed).not.toBe(original)
  })

  it('reads the current mode from a DSH context-injection message', () => {
    const request = options('unknown')
    request.system = 'You are a coding agent.'
    ;(request as any).messages = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Current DSH file policy: workspace-write. Writes are confined.' }],
      },
    ]
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
  })

  it('prefers newest message over stale system policy (regression)', () => {
    const request = options('workspace-write')
    // system is stale workspace-write, newest message is danger-full-access -> must remove fields
    ;(request as any).messages = [
      { role: 'user', content: [{ type: 'text', text: 'Current DSH file policy: read-only. Initial.' }] },
      { role: 'user', content: [{ type: 'text', text: 'Current DSH file policy: danger-full-access. Updated after approval.' }] },
    ]
    // system still says workspace-write
    request.system = 'Current DSH file policy: workspace-write.'
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    const params = narrowed.tools?.[0]?.parameters as any
    expect(params.properties.sandbox_permissions).toBeUndefined()
    expect(params.properties.justification).toBeUndefined()
    expect(params.required).toEqual(['file_path'])
    // ensure reverse also works: if system is danger but message is newest workspace, should keep danger
    const request2 = options('danger-full-access')
    ;(request2 as any).messages = [
      { role: 'user', content: [{ type: 'text', text: 'Current DSH file policy: workspace-write. Latest injection.' }] },
    ]
    request2.system = 'Current DSH file policy: danger-full-access.'
    const narrowed2 = narrowOpenCodeGoEscalationSchemas(request2 as never)
    expect((narrowed2.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
  })

    it('scans nested content blocks (text field) and array payloads', () => {
    const request = options('unknown')
    request.system = undefined as any
    ;(request as any).messages = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Current DSH file policy: read-only. Start.' }],
      },
    ]
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['workspace-write', 'danger-full-access'])
  })

  it('removes impossible escalation fields from a danger-full-access session', () => {
    const narrowed = narrowOpenCodeGoEscalationSchemas(options('danger-full-access') as never)
    const parameters = narrowed.tools?.[0]?.parameters as any
    expect(parameters.properties.sandbox_permissions).toBeUndefined()
    expect(parameters.properties.justification).toBeUndefined()
    expect(parameters.required).toEqual(['file_path'])
  })

  it('removes fields when policy is danger-full-access via messages injection', () => {
    const request = options('unknown')
    request.system = undefined as any
    ;(request as any).messages = [
      { role: 'user', content: [{ type: 'text', text: 'Current DSH file policy: danger-full-access.' }] },
    ]
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    const parameters = narrowed.tools?.[0]?.parameters as any
    expect(parameters.properties.sandbox_permissions).toBeUndefined()
    expect(parameters.properties.justification).toBeUndefined()
  })

  it('keeps both wider modes available to a read-only session', () => {
    const narrowed = narrowOpenCodeGoEscalationSchemas(options('read-only') as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['workspace-write', 'danger-full-access'])
  })

  it('is immutable and does not mutate original tool objects', () => {
    const original = options('danger-full-access')
    const before = JSON.stringify(original)
    const narrowed = narrowOpenCodeGoEscalationSchemas(original as never)
    expect(JSON.stringify(original)).toBe(before)
    expect(narrowed).not.toBe(original)
    const readOnlyOriginal = options('read-only')
    const readOnlyNarrowed = narrowOpenCodeGoEscalationSchemas(readOnlyOriginal as never)
    expect(readOnlyNarrowed).toBe(readOnlyOriginal)
  })

  it('leaves tools without sandbox_permissions untouched', () => {
    const request = {
      provider: 'opencode-go',
      model: 'glm-5.3',
      messages: [],
      system: 'Current DSH file policy: workspace-write.',
      tools: [{ name: 'read', description: 'r', parameters: { type: 'object', properties: { file_path: { type: 'string' } } } }],
    }
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    expect(narrowed).toBe(request)
  })

  it('returns original when no mode can be determined', () => {
    const request = options('unknown')
    request.system = 'no policy here'
    ;(request as any).messages = []
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    expect(narrowed).toBe(request)
  })

  it('handles multiple tools, narrowing only those with escalation fields', () => {
    const request = {
      provider: 'opencode-go',
      model: 'glm-5.3',
      messages: [],
      system: 'Current DSH file policy: workspace-write.',
      tools: [
        {
          name: 'write',
          description: 'w',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
              justification: { type: 'string' },
            },
            required: ['file_path'],
          },
        },
        {
          name: 'read',
          description: 'r',
          parameters: { type: 'object', properties: { file_path: { type: 'string' } } },
        },
      ],
    }
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
    expect((narrowed.tools?.[1]?.parameters as any).properties.sandbox_permissions).toBeUndefined()
  })

  it('handles string content payload in messages', () => {
    const request = options('unknown')
    request.system = undefined as any
    ;(request as any).messages = [
      { role: 'user', content: 'Current DSH file policy: workspace-write.' } as any,
    ]
    const narrowed = narrowOpenCodeGoEscalationSchemas(request as never)
    expect((narrowed.tools?.[0]?.parameters as any).properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
  })
})

describe('OpenCodeGoAdapter sandbox filtering (direct vs prepared)', () => {
  it('filters on direct stream', async () => {
    const stable = connection([{ id: 'glm-5.3', contextWindow: 1_000_000 }])
    const adapter = new OpenCodeGoAdapter({
      options: () => stable,
      resolveApiKey: async () => 'test-key',
    })
    const captured: any[] = []
    const fakePi = {
      stream: (opts: any) => {
        captured.push(opts)
        return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })()
      },
      prepareCall: async () => ({ model: { provider: 'opencode-go', id: 'glm-5.3', name: 'glm-5.3' }, stream: (opts: any) => { captured.push(opts); return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })() } }),
    }
    ;(adapter as any).snapshot = { options: stable, adapter: fakePi }
    ;(adapter as any).current = () => fakePi as any
    const tools = [{ name: 'write', description: 'w', parameters: { type: 'object', properties: { file_path: { type: 'string' }, sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] }, justification: { type: 'string' } }, required: ['file_path'] } }]
    for await (const _ of adapter.stream({ provider: 'opencode-go', model: 'glm-5.3', messages: [], system: 'Current DSH file policy: danger-full-access.', tools } as never)) {}
    expect(captured.length).toBe(1)
    const params = captured[0].tools[0].parameters as any
    expect(params.properties.sandbox_permissions).toBeUndefined()
    expect(params.properties.justification).toBeUndefined()
  })

  it('filters on prepared stream', async () => {
    const adapter = new OpenCodeGoAdapter({
      options: () => connection([{ id: 'glm-5.3', contextWindow: 1_000_000 }]),
      resolveApiKey: async () => 'test-key',
    })
    const captured: any[] = []
    const fakePi = {
      stream: (opts: any) => {
        captured.push(opts)
        return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })()
      },
      prepareCall: async () => ({ model: { provider: 'opencode-go', id: 'glm-5.3', name: 'x' }, stream: (opts: any) => { captured.push(opts); return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })() } }),
    }
    ;(adapter as any).snapshot = { options: (adapter as any).config.options(), adapter: fakePi }
    // need to ensure current() returns fakePi on next call
    ;(adapter as any).current = () => fakePi as any
    const prep2 = await adapter.prepareCall('opencode-go', 'glm-5.3')
    const tools = [{ name: 'write', description: 'w', parameters: { type: 'object', properties: { file_path: { type: 'string' }, sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] }, justification: { type: 'string' } }, required: ['file_path'] } }]
    for await (const _ of prep2.stream({ provider: 'opencode-go', model: 'glm-5.3', messages: [], system: 'Current DSH file policy: workspace-write.', tools } as never)) {}
    expect(captured[0].tools[0].parameters.properties.sandbox_permissions.enum).toEqual(['danger-full-access'])
  })
})

describe('sandbox filtering across protocols (completions/responses/messages)', () => {
  it('narrows tool schemas regardless of model api', async () => {
    // This test verifies the narrowing is protocol-agnostic by checking all three model apis
    const models: Array<{ id: string; api: string }> = [
      { id: 'glm-5.3', api: 'openai-completions' },
      { id: 'grok-4.6', api: 'openai-responses' },
      { id: 'minimax-m3', api: 'anthropic-messages' },
    ]
    const toolWithBoth = {
      name: 'write',
      description: 'write',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
          justification: { type: 'string' },
        },
        required: ['file_path', 'sandbox_permissions', 'justification'],
      },
    }
    for (const { id, api } of models) {
      const adapter = new OpenCodeGoAdapter({
        options: () => connection([{ id, contextWindow: 1_000_000, api } as never]),
        resolveApiKey: async () => 'test-key',
      })
      const captured: any[] = []
      const fakePi = {
        stream: (opts: any) => {
          captured.push(opts)
          return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })()
        },
        prepareCall: async () => ({
          model: { provider: 'opencode-go', id, name: id },
          stream: (opts: any) => {
            captured.push(opts)
            return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } } })()
          },
        }),
      }
      ;(adapter as any).snapshot = { options: (adapter as any).config.options(), adapter: fakePi }
      ;(adapter as any).current = () => fakePi as any

      // direct
      captured.length = 0
      for await (const _ of adapter.stream({ provider: 'opencode-go', model: id, messages: [], system: 'Current DSH file policy: workspace-write.', tools: [toolWithBoth] } as never)) {}
      expect(captured[0].tools[0].parameters.properties.sandbox_permissions.enum, 'direct ' + api).toEqual(['danger-full-access'])

      // prepared
      captured.length = 0
      const prep = await adapter.prepareCall('opencode-go', id)
      for await (const _ of prep.stream({ provider: 'opencode-go', model: id, messages: [], system: 'Current DSH file policy: danger-full-access.', tools: [toolWithBoth] } as never)) {}
      expect(captured[0].tools[0].parameters.properties.sandbox_permissions, 'prepared ' + api).toBeUndefined()
    }
  })

  it('direct stream via composition still narrows HTTP payload (completions)', async () => {
    let root: string | undefined
    let context: Context | undefined
    try {
      const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const { pathToFileURL } = await import('node:url')
      root = await mkdtemp(join(tmpdir(), 'dsh-llm-opencode-go-proto-'))
      const configPath = join(root, 'cordis.yml')
      await writeFile(
        configPath,
        [
          '- id: llm',
          "  name: 'test-llm-service'",
          '- id: llm-opencode-go',
          "  name: 'dsh-llm-opencode-go'",
          '  config:',
          '    baseURL: ' + JSON.stringify((await mockServer([{ kind: 'sse', events: openAITextEvents }])).url),
          '    models:',
          '      - id: glm-5.3',
          '        contextWindow: 1000000',
          '        api: openai-completions',
          '',
        ].join('\n'),
      )
      // Actually create server separately to capture
      const server = await mockServer([{ kind: 'sse', events: openAITextEvents }])
      // rewrite config with server url
      await writeFile(configPath, [
        '- id: llm',
        "  name: 'test-llm-service'",
        '- id: llm-opencode-go',
        "  name: 'dsh-llm-opencode-go'",
        '  config:',
        '    baseURL: ' + JSON.stringify(server.url),
        '    models:',
        '      - id: glm-5.3',
        '        contextWindow: 1000000',
        '        api: openai-completions',
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
          const m = modules.get(specifier)
          if (m === undefined) throw new Error('unexpected Loader import: ' + specifier)
          return m
        },
      } as unknown as NonNullable<typeof ctx.loader.internal>
      await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
      await ctx.loader.await()
      vi.stubEnv('OPENCODE_API_KEY', 'test-key')
      const toolWithBoth = {
        name: 'write',
        description: 'write',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
            justification: { type: 'string' },
          },
          required: ['file_path', 'sandbox_permissions', 'justification'],
        },
      }
      const result = await assemble(ctx, {
        model: 'glm-5.3',
        messages: [],
        system: 'Current DSH file policy: workspace-write.',
        tools: [toolWithBoth],
      } as never)
      expect(result.finish).toEqual({ kind: 'stop' })
      const body = JSON.stringify(server.requests[0])
      expect(body).toContain('danger-full-access')
      expect(body).not.toContain('"enum":["workspace-write","danger-full-access"]')
    } finally {
      await context?.fiber.dispose()
      if (root) await rm(root, { recursive: true, force: true })
      await closeMockServers()
      vi.unstubAllEnvs()
    }
  })
})