import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { apply, Config, inject } from '../src/index.ts'
import {
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_RPC_CHANNEL,
  OPENCODE_GO_USAGE_ENDPOINT,
} from '../src/client-contract.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

afterEach(async () => {
  vi.restoreAllMocks()
  await closeMockServers()
})

describe('OpenCode Go rich-discovery RPC', () => {
  it('registers the alpha channel and discovers from GET /models', async () => {
    type Handler = (
      endpoint: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<{ ok: boolean; value?: unknown; error?: unknown }>
    const ctx = new Context()
    await ctx.plugin(LlmRuntime).await()
    const handle = vi.fn((_channel: string, _handler: Handler) =>
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
    expect(registration).toHaveLength(2)
    expect(registration[0]).toBe(OPENCODE_GO_RPC_CHANNEL)
    const handler = registration[1]
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const controller = new AbortController()
    const server = await mockServer([
      { kind: 'json', status: 200, body: JSON.stringify({ data: [{ id: 'grok-4.6' }, { id: 'minimax-m3' }] }) },
    ])
    const result = await handler(
      OPENCODE_GO_DISCOVER_ENDPOINT,
      { baseURL: server.url },
      controller.signal,
    )
    expect(result.ok).toBe(true)
    const fetchOptions = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
    expect(fetchOptions?.signal).toBeInstanceOf(AbortSignal)
    controller.abort()
    expect(fetchOptions?.signal?.aborted).toBe(true)
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

  it('rejects removed remoteManagement configuration before registering a route', () => {
    expect(() => apply(new Context(), { remoteManagement: true } as Config)).toThrow(
      'remoteManagement is unsupported by the alpha.1 Host RPC',
    )
  })

  it('reads GET /usage through the same alpha channel', async () => {
    type Handler = (
      endpoint: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<{ ok: boolean; value?: unknown }>
    const ctx = new Context()
    await ctx.plugin(LlmRuntime).await()
    const handle = vi.fn((_channel: string, _handler: Handler) =>
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

  it('disposes the RPC handle once with the Host plugin fiber', async () => {
    type Handler = (
      endpoint: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<{ ok: boolean; value?: unknown }>
    const ctx = new Context()
    await ctx.plugin(LlmRuntime).await()
    const remove = vi.fn(async () => undefined)
    const handle = vi.fn((_channel: string, _handler: Handler) => remove)
    ctx.provide('connection', { rpc: { handle } } as never)
    ctx.provide('credentials', {
      resolve: async () => ({ value: 'key' }),
    } as never)
    const fiber = ctx.plugin({ inject: [...inject], Config, apply }, {})
    await fiber.await()
    expect(handle).toHaveBeenCalledTimes(1)

    await fiber.dispose()
    expect(remove).toHaveBeenCalledTimes(1)

    await fiber.dispose()
    expect(remove).toHaveBeenCalledTimes(1)
    await ctx.fiber.dispose()
  })
})
