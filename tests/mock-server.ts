import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

/** One scripted behavior for the next request the mock server receives. */
export type Behavior =
  | { kind: 'sse'; events: string[] }
  | { kind: 'json'; status: number; body: string; headers?: Record<string, string> }
  | { kind: 'close-early'; lines: string[] }

export interface MockServer {
  url: string
  /** Bodies of received requests, in order. */
  requests: unknown[]
  /** Header bags of received requests, in order (parallel to `requests`). */
  headers: IncomingMessage['headers'][]
  script: Behavior[]
  close(): Promise<void>
}

const servers: Server[] = []

/** Close every server opened since the last call; run from each spec's afterEach. */
export async function closeMockServers(): Promise<void> {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
}

/** A minimal complete OpenAI Chat Completions SSE response. */
export const openAITextEvents = [
  '{"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-oss:20b","choices":[{"index":0,"delta":{"role":"assistant","content":"hello"}}]}',
  '{"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-oss:20b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}',
  '[DONE]',
]

/** A minimal complete OpenAI Responses SSE response. */
export const openAIResponsesTextEvents = [
  '{"type":"response.created","response":{"id":"resp-test","status":"in_progress"}}',
  '{"type":"response.output_item.added","output_index":0,"item":{"type":"message","id":"msg-test","role":"assistant","content":[]}}',
  '{"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"hello"}',
  '{"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":"msg-test","role":"assistant","content":[{"type":"output_text","text":"hello"}]}}',
  '{"type":"response.completed","response":{"id":"resp-test","status":"completed","output":[],"usage":{"input_tokens":3,"output_tokens":1,"total_tokens":4}}}',
  '[DONE]',
]

/** Local OpenCode Go API stand-in: replays scripted behaviors per request. */
export async function mockServer(script: Behavior[]): Promise<MockServer> {
  const requests: unknown[] = []
  const headers: IncomingMessage['headers'][] = []
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    let body = ''
    request.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
    request.on('end', () => {
      try { requests.push(JSON.parse(body)) } catch { requests.push(body) }
      headers.push(request.headers)
      const behavior = script.shift()
      if (!behavior) {
        response.writeHead(500).end('mock script exhausted')
        return
      }
      if (behavior.kind === 'json') {
        response.writeHead(behavior.status, { 'content-type': 'application/json', ...behavior.headers })
        response.end(behavior.body)
        return
      }
      if (behavior.kind === 'sse') {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.end(behavior.events.map(event => `data: ${event}\n\n`).join(''))
        return
      }
      response.writeHead(500).end(`unsupported mock behavior: ${behavior.kind}`)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('mock server address unavailable')
  servers.push(server)
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    headers,
    script,
    close: () => new Promise<void>(resolve => server.close(() =>{  resolve() })),
  }
}
