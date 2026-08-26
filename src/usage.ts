/**
 * Host-only OpenCode Go subscription usage. Official endpoint:
 * GET https://opencode.ai/zen/go/v1/usage
 * returns rolling / weekly / monthly percent windows. Never blocks chat.
 */

import { attributionHeaders, INVALID_CREDENTIAL_CODE, LlmError } from '@deepseek-ai/dsh-llm'
import { OPENCODE_GO_PUBLIC_BASE_URL } from './client-contract.ts'
import type { OpenCodeGoUsageModelCount, OpenCodeGoUsageView, OpenCodeGoUsageWindow } from './client-contract.ts'
import { isJsonRecord, readBoundedText, requireUsableApiKey } from './http.ts'

export const DEFAULT_USAGE_REQUEST_TIMEOUT_MS = 15_000
export const OPENCODE_GO_USAGE_UNSUPPORTED = 'OPENCODE_GO_USAGE_UNSUPPORTED'
export const OPENCODE_GO_USAGE_FAILED = 'OPENCODE_GO_USAGE_FAILED'
const MAX_USAGE_BYTES = 1024 * 1024

export interface OpenCodeGoUsageRequest {
  baseURL?: string
  signal?: AbortSignal
}

function parseModelCounts(value: unknown): OpenCodeGoUsageModelCount[] {
  if (!Array.isArray(value)) return []
  const models: OpenCodeGoUsageModelCount[] = []
  for (const entry of value) {
    if (!isJsonRecord(entry)) continue
    const name = typeof entry.name === 'string' && entry.name.length > 0
      ? entry.name
      : typeof entry.model === 'string' && entry.model.length > 0
        ? entry.model
        : undefined
    const requestCount = typeof entry.requestCount === 'number'
      ? entry.requestCount
      : typeof entry.count === 'number'
        ? entry.count
        : typeof entry.requests === 'number'
          ? entry.requests
          : undefined
    if (name === undefined || requestCount === undefined || !Number.isSafeInteger(requestCount) || requestCount < 0) continue
    models.push({ name, requestCount })
  }
  return models
}

function isoInstant(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
}

function parseWindow(value: unknown): OpenCodeGoUsageWindow | undefined {
  if (!isJsonRecord(value)) return undefined
  const status = value.status
  if (status !== undefined && status !== 'ok' && status !== 'rate-limited') return undefined
  let fraction: number | undefined
  if (typeof value.percent === 'number' && Number.isFinite(value.percent) && value.percent >= 0) {
    fraction = value.percent / 100
  } else if (typeof value.usagePercent === 'number' && Number.isFinite(value.usagePercent) && value.usagePercent >= 0) {
    fraction = value.usagePercent / 100
  } else if (typeof value.usage === 'number' && Number.isFinite(value.usage) && value.usage >= 0) {
    fraction = value.usage > 1 ? value.usage / 100 : value.usage
  }
  if (fraction === undefined) return undefined
  const resetsAt = isoInstant(value.resetsAt ?? value.resets_at ?? value.resetAt)
  return {
    usage: fraction,
    models: parseModelCounts(value.models),
    ...(resetsAt === undefined ? {} : { resetsAt }),
  }
}

function unwrapUsage(value: unknown): Record<string, unknown> | undefined {
  if (!isJsonRecord(value)) return undefined
  return isJsonRecord(value.usage) ? value.usage : value
}

/** Convert the official usage reply into the secret-free snapshot the card renders. */
export function parseOpenCodeGoUsage(value: unknown, url: string): OpenCodeGoUsageView {
  const root = unwrapUsage(value)
  if (root === undefined) throw new LlmError(url + ' returned a malformed usage response', OPENCODE_GO_USAGE_FAILED)
  const session = parseWindow(root.rolling ?? root.rollingUsage ?? root.session)
  const weekly = parseWindow(root.weekly ?? root.weeklyUsage)
  const monthly = parseWindow(root.monthly ?? root.monthlyUsage)
  if (session === undefined && weekly === undefined && monthly === undefined) {
    throw new LlmError(url + ' returned a malformed usage response', OPENCODE_GO_USAGE_FAILED)
  }
  return {
    fetchedAt: new Date().toISOString(),
    ...(session === undefined ? {} : { session }),
    ...(weekly === undefined ? {} : { weekly }),
    ...(monthly === undefined ? {} : { monthly }),
  }
}

/** Read rolling/weekly/monthly subscription windows without issuing a model request. */
export async function readOpenCodeGoUsage(
  request: OpenCodeGoUsageRequest,
  storedApiKey?: () => Promise<string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenCodeGoUsageView> {
  const baseURL = (request.baseURL ?? OPENCODE_GO_PUBLIC_BASE_URL).replace(/\/+$/u, '')
  const supplied = await storedApiKey?.()
  if (supplied === undefined || supplied.trim().length === 0) {
    throw new LlmError('OpenCode Go usage requires a configured API key', 'MISSING_CREDENTIAL')
  }
  const apiKey = requireUsableApiKey(
    supplied,
    'this provider\'s API key is blank; enter it in Plugin configuration first',
  )
  const url = baseURL + '/usage'
  const timeout = AbortSignal.timeout(DEFAULT_USAGE_REQUEST_TIMEOUT_MS)
  const signal = request.signal === undefined ? timeout : AbortSignal.any([request.signal, timeout])
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer ' + apiKey,
        ...attributionHeaders(),
      },
      redirect: 'error',
      signal,
    })
  } catch (error: unknown) {
    if (request.signal?.aborted) throw new LlmError('OpenCode Go usage read aborted by caller', 'ABORTED', { cause: error })
    const detail = error instanceof Error && error.message.length > 0 ? ': ' + error.message : ''
    throw new LlmError('could not reach ' + url + detail, OPENCODE_GO_USAGE_FAILED, { cause: error })
  }
  if (response.status === 404) {
    await response.body?.cancel()
    throw new LlmError('this OpenCode Go endpoint does not report subscription usage', OPENCODE_GO_USAGE_UNSUPPORTED)
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new LlmError(
      url + ' answered ' + String(response.status) + (response.status === 401 || response.status === 403 ? '; check the API key' : ''),
      response.status === 401 || response.status === 403 ? INVALID_CREDENTIAL_CODE : OPENCODE_GO_USAGE_FAILED,
    )
  }
  let text: string
  try {
    text = await readBoundedText(response, MAX_USAGE_BYTES, url, OPENCODE_GO_USAGE_FAILED, signal)
  } catch (error: unknown) {
    if (error instanceof LlmError) throw error
    throw new LlmError(url + ' could not be read', OPENCODE_GO_USAGE_FAILED, { cause: error })
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch (error: unknown) {
    throw new LlmError(url + ' did not answer with JSON', OPENCODE_GO_USAGE_FAILED, { cause: error })
  }
  return parseOpenCodeGoUsage(body, url)
}
