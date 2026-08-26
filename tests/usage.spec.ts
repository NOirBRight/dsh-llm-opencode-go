import { describe, expect, it, vi } from 'vitest'
import { parseOpenCodeGoUsage, readOpenCodeGoUsage } from '../src/usage.ts'

describe('OpenCode Go subscription usage', () => {
  it('parses official rolling/weekly/monthly percent windows', () => {
    const result = parseOpenCodeGoUsage({
      usage: {
        rolling: { status: 'ok', percent: 4, resetsAt: '2026-08-13T16:27:38.287Z' },
        weekly: { status: 'ok', percent: 30, resetsAt: '2026-08-17T00:00:00.287Z' },
        monthly: { status: 'ok', percent: 1, resetsAt: '2026-09-13T06:06:01.287Z' },
      },
    }, 'https://opencode.ai/zen/go/v1/usage')
    expect(result.session?.usage).toBeCloseTo(0.04)
    expect(result.weekly?.usage).toBeCloseTo(0.3)
    expect(result.monthly?.usage).toBeCloseTo(0.01)
    expect(result.session?.resetsAt).toBe('2026-08-13T16:27:38.287Z')
  })

  it('copies per-model request counts when the endpoint reports them', () => {
    const result = parseOpenCodeGoUsage({
      usage: {
        weekly: {
          status: 'ok',
          percent: 10,
          models: [
            { name: 'glm-5.3', requestCount: 4 },
            { model: 'kimi-k3', count: 2 },
          ],
        },
      },
    }, 'https://opencode.ai/zen/go/v1/usage')
    expect(result.weekly?.models).toEqual([
      { name: 'glm-5.3', requestCount: 4 },
      { name: 'kimi-k3', requestCount: 2 },
    ])
  })

  it('reads GET /usage with the Bearer key', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://opencode.ai/zen/go/v1/usage')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer key')
      return new Response(JSON.stringify({
        usage: { rolling: { status: 'ok', percent: 12, resetsAt: '2026-08-13T00:00:00.000Z' } },
      }))
    })
    const result = await readOpenCodeGoUsage({}, async () => 'key', fetchImpl)
    expect(result.session?.usage).toBeCloseTo(0.12)
  })

  it('returns unsupported when the usage surface is absent', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }))
    await expect(readOpenCodeGoUsage({}, async () => 'key', fetchImpl)).rejects.toMatchObject({
      code: 'OPENCODE_GO_USAGE_UNSUPPORTED',
    })
  })

  it('requires a key before making any usage request', async () => {
    const fetchImpl = vi.fn()
    await expect(readOpenCodeGoUsage({}, undefined, fetchImpl)).rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
