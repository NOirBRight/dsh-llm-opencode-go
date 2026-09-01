/**
 * Live OpenCode Go model listing. GET /models returns ids only; documented
 * capacities and protocol are merged from the local catalog without inventing
 * windows for unknown ids.
 */

import { attributionHeaders, INVALID_CREDENTIAL_CODE, LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm'
import { OPENCODE_GO_PUBLIC_BASE_URL } from './client-contract.ts'
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts'
import { enrichModel } from './catalog.ts'
import { isJsonRecord, readBoundedText, requireUsableApiKey } from './http.ts'

export const PUBLIC_BASE_URL = OPENCODE_GO_PUBLIC_BASE_URL
export const MAX_DISCOVERY_BYTES = 4 * 1024 * 1024
export const DISCOVERY_TIMEOUT_MS = 30_000

export type OpenCodeGoDiscoveredModel = OpenCodeGoCatalogModelConfig

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Parse the OpenAI-shaped listing and attach documented metadata. */
export function parseOpenCodeGoModels(value: unknown): OpenCodeGoDiscoveredModel[] {
  const data = isJsonRecord(value) ? value.data : undefined
  if (!Array.isArray(data)) throw new LlmError('OpenCode Go model listing has no data array', 'DISCOVERY_FAILED')
  const models: OpenCodeGoDiscoveredModel[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    if (!isJsonRecord(raw)) continue
    const id = nonEmpty(raw.id)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const name = nonEmpty(raw.name)
    const contextWindow = positiveInteger(raw.context_length) ?? positiveInteger(raw.context_window)
    const maxTokens = positiveInteger(raw.max_output_tokens) ?? positiveInteger(raw.max_tokens)
    models.push(enrichModel(id, {
      ...(name === undefined ? {} : { name }),
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(maxTokens === undefined ? {} : { maxTokens }),
    }))
  }
  return models
}

function listingURL(baseURL: string): string {
  return baseURL.replace(/\/+$/u, '') + '/models'
}

/** Fetch the current public model catalog. */
export async function discoverModels(
  request: LlmModelDiscoveryRequest,
  storedApiKey?: () => Promise<string | undefined>,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<readonly OpenCodeGoDiscoveredModel[]> {
  const baseURL = (request.baseURL ?? PUBLIC_BASE_URL).replace(/\/+$/u, '')
  const supplied = request.apiKey ?? await storedApiKey?.()
  const apiKey = supplied === undefined || supplied.trim().length === 0
    ? undefined
    : requireUsableApiKey(
      supplied,
      'this provider\'s API key is blank; enter it in Plugin configuration, or clear it to probe unauthenticated',
    )
  const url = listingURL(baseURL)
  const timeout = AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)
  const requestSignal = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(apiKey === undefined ? {} : { authorization: 'Bearer ' + apiKey }),
        ...attributionHeaders(),
      },
      redirect: 'error',
      signal: requestSignal,
    })
  } catch (error: unknown) {
    if (signal?.aborted) throw new LlmError('OpenCode Go model discovery aborted', 'ABORTED', { cause: error })
    throw new LlmError('Could not reach OpenCode Go model catalog', 'DISCOVERY_FAILED', { cause: error })
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new LlmError(
      url + ' answered HTTP ' + String(response.status),
      response.status === 401 || response.status === 403 ? INVALID_CREDENTIAL_CODE : 'DISCOVERY_FAILED',
      { status: response.status },
    )
  }
  let body: unknown
  try {
    body = JSON.parse(await readBoundedText(response, MAX_DISCOVERY_BYTES, url, 'DISCOVERY_FAILED', requestSignal))
  } catch (error: unknown) {
    if (error instanceof LlmError) throw error
    if (signal?.aborted) throw new LlmError('OpenCode Go model discovery aborted', 'ABORTED', { cause: error })
    throw new LlmError('OpenCode Go model catalog did not return JSON', 'DISCOVERY_FAILED', { cause: error })
  }
  return parseOpenCodeGoModels(body)
}
