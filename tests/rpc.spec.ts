import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { apply, Config, inject } from '../src/index.ts'
import {
  OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
  OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_RPC_CHANNEL,
  OPENCODE_GO_USAGE_ENDPOINT,
} from '../src/client-contract.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

afterEach(async () => { await closeMockServers() })

describe('OpenCode Go rich-discovery RPC', () => {
  it('registers a loopback channel and discovers from GET /models', async () => {
    type Handler = (
      endpoint: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<{ ok: boolean; value?: unknown; error?: unknown }>
    const ctx = new Context()
    await ctx.plugin(LlmRuntime).await()
    const handle = vi.fn((_channel: string, _handler: Handler, _options: { authority: 'loopback' }) =>
      () => Promise.resolve())
    ctx.provide('connection', { rpc: { handle } } as never)
    ctx.provide('credentials', {
      resolve: async () => ({ value: 'stored-key' }),
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], Config, apply }, {})
    await fiber.await()
    expect(handle).toHaveBeenCalledTimes(1)
    const registration = handle.mock.calls[0]
    if (registration === undefined) throw new Error('rich-discovery RPC was not registered')
    expect(registration[0]).toBe(OPENCODE_GO_RPC_CHANNEL)
    expect(registration[2]).toEqual({ authority: 'loopback' })
    const handler = registration[1]
    const server = await mockServer([
      { kind: 'json', status: 200, body: JSON.stringify({ data: [{ id: 'grok-4.6' }, { id: 'minimax-m3' }] }) },
    ])
    const result = await handler(
      OPENCODE_GO_DISCOVER_ENDPOINT,
      { baseURL: server.url },
      new AbortController().signal,
    )
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({
      models: [
        expect.objectContaining({ id: 'grok-4.6', api: 'openai-responses', vision: true }),
        expect.objectContaining({ id: 'minimax-m3', api: 'anthropic-messages' }),
      ],
    })
    expect(server.headers[0]?.authorization).toBe('Bearer stored-key')
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('reports a legacy key and stores replacements under the official reference', async () => {
    type Handler = (
      endpoint: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<{ ok: boolean; value?: unknown; error?: unknown }>
    const values = new Map([['OPENCODE_GO_API_KEY', 'legacy-test-key']])
    const ctx = new Context()
    await ctx.plugin(LlmRuntime).await()
    const handle = vi.fn((_channel: string, _handler: Handler, _options: { authority: 'loopback' }) =>
      () => Promise.resolve())
    const set = vi.fn(async (ref: string, value: string) => { values.set(ref, value) })
    ctx.provide('connection', { rpc: { handle } } as never)
    ctx.provide('credentials', {
      resolve: async (ref: string) => {
        const value = values.get(ref)
        return value === undefined ? undefined : { value, source: 'test' }
      },
      describe: async (ref: string) => ({ configured: values.has(ref), writable: true }),
      set,
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], Config, apply }, {})
    await fiber.await()
    const handler = handle.mock.calls[0]?.[1]
    if (handler === undefined) throw new Error('rpc handler missing')

    const status = await handler(
      OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT,
      {},
      new AbortController().signal,
    )
    expect(status).toEqual({ ok: true, value: { configured: true, writable: true } })

    const stored = await handler(
      OPENCODE_GO_CREDENTIAL_SET_ENDPOINT,
      { apiKey: 'new-test-key' },
      new AbortController().signal,
    )
    expect(stored).toEqual({ ok: true, value: { configured: true, writable: true } })
    expect(set).toHaveBeenCalledWith('OPENCODE_API_KEY', 'new-test-key')

    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('reads GET /usage through the same loopback channel', async () => {
    type Handler = (
      endpoint: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<{ ok: boolean; value?: unknown }>
    const ctx = new Context()
    await ctx.plugin(LlmRuntime).await()
    const handle = vi.fn((_channel: string, _handler: Handler, _options: { authority: 'loopback' }) =>
      () => Promise.resolve())
    ctx.provide('connection', { rpc: { handle } } as never)
    ctx.provide('credentials', {
      resolve: async () => ({ value: 'key' }),
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], Config, apply }, {})
    await fiber.await()
    const handler = handle.mock.calls[0]?.[1]
    if (handler === undefined) throw new Error('rpc handler missing')
    const server = await mockServer([
      { kind: 'json', status: 200, body: JSON.stringify({ usage: { rolling: { status: 'ok', percent: 8 } } }) },
    ])
    const result = await handler(
      OPENCODE_GO_USAGE_ENDPOINT,
      { baseURL: server.url },
      new AbortController().signal,
    )
    expect(result.ok).toBe(true)
    expect(result.value).toMatchObject({ status: 'ok', usage: { session: { usage: 0.08 } } })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })
})
