import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { apply, Config, inject } from '../src/index.ts'
import {
  OPENCODE_GO_DISCOVER_ENDPOINT,
  OPENCODE_GO_RPC_ENDPOINT,
  OPENCODE_GO_USAGE_ENDPOINT,
} from '../src/client-contract.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

afterEach(async () => {
  vi.restoreAllMocks()
  await closeMockServers()
})

interface PluginRpcRoute {
  path: string
  methods: readonly string[]
  requestBody: 'buffered'
  fetch: (request: Request) => Promise<Response>
}

async function hostRoute() {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime).await()
  const dispose = vi.fn(() => Promise.resolve())
  const routes: PluginRpcRoute[] = []
  const register = vi.fn((route: PluginRpcRoute) => {
    routes.push(route)
    return dispose
  })
  ctx.provide('connection', { fetch: { register }, operator: {} } as never)
  ctx.provide('webServer', { register: () => () => undefined } as never)
  ctx.provide('credentials', { resolve: async () => ({ value: 'stored-key' }) } as never)
  const fiber = ctx.plugin({ inject: [...inject], Config, apply }, {})
  await fiber.await()
  const route = routes[0]
  if (route === undefined) throw new Error('OpenCode Go plugin Fetch route was not registered')
  return { ctx, fiber, register, route, dispose }
}

function clientRequest(endpoint: string, payload?: unknown, method = OPENCODE_GO_RPC_ENDPOINT) {
  return {
    type: 'client-request',
    rpcId: 'rpc-test',
    method,
    payload: {
      endpoint,
      ...(payload === undefined ? {} : { payload }),
    },
  }
}

function post(route: PluginRpcRoute, body: string, contentType = 'application/json', signal?: AbortSignal): Promise<Response> {
  return route.fetch(new Request('http://localhost' + route.path, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
    ...(signal === undefined ? {} : { signal }),
  }))
}

describe('OpenCode Go authenticated plugin RPC Fetch route', () => {
  it('registers one buffered API route and discovers from GET /models', async () => {
    const { ctx, fiber, register, route } = await hostRoute()
    expect(register).toHaveBeenCalledTimes(1)
    expect(route).toMatchObject({
      path: '/api/' + OPENCODE_GO_RPC_ENDPOINT,
      methods: ['POST'],
      requestBody: 'buffered',
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const controller = new AbortController()
    const server = await mockServer([
      { kind: 'json', status: 200, body: JSON.stringify({ data: [{ id: 'grok-4.6' }, { id: 'minimax-m3' }] }) },
    ])
    const response = await post(
      route,
      JSON.stringify(clientRequest(OPENCODE_GO_DISCOVER_ENDPOINT, { baseURL: server.url })),
      'application/json',
      controller.signal,
    )
    const wire = await response.json()
    expect(response.status).toBe(200)
    expect(wire).toMatchObject({
      type: 'server-response',
      rpcId: 'rpc-test',
      result: {
        ok: true,
        value: {
          models: [
            expect.objectContaining({ id: 'grok-4.6', api: 'openai-responses', vision: true }),
            expect.objectContaining({ id: 'minimax-m3', api: 'anthropic-messages' }),
          ],
        },
      },
    })
    const listingCall = fetchSpy.mock.calls.find(([input]) => String(input).startsWith(server.url))
    const fetchOptions = listingCall?.[1] as RequestInit | undefined
    expect(fetchOptions?.signal).toBeInstanceOf(AbortSignal)
    controller.abort()
    expect(fetchOptions?.signal?.aborted).toBe(true)
    expect(server.headers[0]?.authorization).toBe('Bearer stored-key')
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('accepts an omitted wrapped payload and preserves business failures as HTTP 200 RPC results', async () => {
    const { ctx, fiber, route } = await hostRoute()
    const response = await post(route, JSON.stringify(clientRequest('unknown endpoint')))
    const wire = await response.json()
    expect(response.status).toBe(200)
    expect(wire).toMatchObject({
      type: 'server-response',
      rpcId: 'rpc-test',
      result: { ok: false, error: { message: 'unknown OpenCode Go endpoint: unknown endpoint' } },
    })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('rejects unsupported media types and malformed or mismatched envelopes', async () => {
    const { ctx, fiber, route } = await hostRoute()
    expect((await post(route, '{}', 'text/plain')).status).toBe(415)
    expect((await post(route, '{')).status).toBe(400)
    expect((await post(route, JSON.stringify(clientRequest('unknown', {}, 'other/method')))).status).toBe(400)
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('reads GET /usage through the same API route', async () => {
    const { ctx, fiber, route } = await hostRoute()
    const server = await mockServer([
      { kind: 'json', status: 200, body: JSON.stringify({ usage: { rolling: { status: 'ok', percent: 8 } } }) },
    ])
    const response = await post(
      route,
      JSON.stringify(clientRequest(OPENCODE_GO_USAGE_ENDPOINT, { baseURL: server.url })),
    )
    const wire = await response.json()
    expect(wire).toMatchObject({
      type: 'server-response',
      rpcId: 'rpc-test',
      result: { ok: true, value: { status: 'ok', usage: { session: { usage: 0.08 } } } },
    })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('rejects removed remoteManagement configuration before registering a route', () => {
    expect(() => apply(new Context(), { remoteManagement: true } as Config)).toThrow(
      'llm-opencode-go: remoteManagement is unsupported by the alpha2 Host Fetch route',
    )
  })

  it('disposes only its Fetch route once with the Host plugin fiber', async () => {
    const { ctx, fiber, register, dispose } = await hostRoute()
    expect(register).toHaveBeenCalledTimes(1)

    await fiber.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)

    await fiber.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    await ctx.fiber.dispose()
  })
})
