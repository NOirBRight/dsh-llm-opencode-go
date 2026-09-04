/** Live models.dev overlay for OpenCode Go ids that GET /models does not describe. */

import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isJsonRecord, readBoundedText } from './http.ts'
import { decodeOpenCodeGoCatalogModel } from './client-contract.ts'
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts'
import { canonOpenCodeGoEffort } from './reasoning.ts'

/** Public models.dev catalog used to fill OpenCode Go capacities. */
export const MODELS_DEV_URL = 'https://models.dev/api.json'
export const MODELS_DEV_MAX_BYTES = 8 * 1024 * 1024
export const MODELS_DEV_TIMEOUT_MS = 15_000
/** How long Fetch will wait for models.dev before showing the local snapshot. */
export const MODELS_DEV_WAIT_MS = 800
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000

export type OpenCodeGoModelsDevOverlay = ReadonlyMap<string, OpenCodeGoCatalogModelConfig>

let cache: { at: number, overlay: OpenCodeGoModelsDevOverlay } | undefined
let inflight: Promise<OpenCodeGoModelsDevOverlay> | undefined
let cachePathOverride: string | undefined

/** Tests point the disk cache at a temp file; production uses tmpdir. */
export function setOpenCodeGoModelsDevCachePathForTests(path: string | undefined): void {
  cachePathOverride = path
}

function diskCachePath(): string | undefined {
  if (cachePathOverride !== undefined) return cachePathOverride
  if (process.env.VITEST !== undefined) return undefined
  return join(tmpdir(), 'dsh-llm-opencode-go-models-dev.json')
}

function hydrateFromDisk(): void {
  if (cache !== undefined) return
  const path = diskCachePath()
  if (path === undefined) return
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!isJsonRecord(parsed) || typeof parsed.at !== 'number' || !Array.isArray(parsed.models)) return
    const overlay = new Map<string, OpenCodeGoCatalogModelConfig>()
    for (const row of parsed.models) {
      const model = decodeOpenCodeGoCatalogModel(row)
      if (model === undefined) continue
      overlay.set(model.id, model)
    }
    cache = { at: parsed.at, overlay }
  } catch {
    // Missing or corrupt cache is fine; the next fetch rebuilds it.
  }
}

function writeDisk(at: number, overlay: OpenCodeGoModelsDevOverlay): void {
  const path = diskCachePath()
  if (path === undefined) return
  try {
    const tmp = path + '.tmp'
    writeFileSync(tmp, JSON.stringify({ at, models: [...overlay.values()] }))
    renameSync(tmp, path)
  } catch {
    // Cache writes are best-effort.
  }
}

/** Drop the process-local models.dev cache. Tests use this. */
export function clearOpenCodeGoModelsDevCache(): void {
  cache = undefined
  inflight = undefined
}

/** Return the cached overlay without fetching. */
export function peekOpenCodeGoModelsDev(): OpenCodeGoModelsDevOverlay | undefined {
  hydrateFromDisk()
  return cache?.overlay
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function effortValues(value: unknown): string[] {
  if (!isJsonRecord(value)) return []
  const options = value.reasoning_options
  if (!Array.isArray(options)) return []
  const found: string[] = []
  for (const option of options) {
    if (!isJsonRecord(option) || !Array.isArray(option.values)) continue
    for (const item of option.values) {
      if (typeof item !== 'string') continue
      const effort = canonOpenCodeGoEffort(item)
      if (effort !== undefined && !found.includes(effort)) found.push(effort)
    }
  }
  return found
}

/** Vision follows input modalities, not the sloppy models.dev attachment flag. */
function visionOf(value: Record<string, unknown>): boolean | undefined {
  const modalities = isJsonRecord(value.modalities) ? value.modalities.input : undefined
  if (!Array.isArray(modalities)) return undefined
  return modalities.includes('image')
}

/** Parse one models.dev OpenCode Go row into catalog fields. */
export function parseOpenCodeGoModelsDevRow(id: string, value: unknown): OpenCodeGoCatalogModelConfig | undefined {
  if (!isJsonRecord(value)) return undefined
  const limit = isJsonRecord(value.limit) ? value.limit : undefined
  const contextWindow = limit === undefined ? undefined : positiveInteger(limit.context)
  const maxTokens = limit === undefined ? undefined : positiveInteger(limit.output)
  const name = nonEmpty(value.name)
  const description = nonEmpty(value.description)
  const efforts = effortValues(value)
  const thinking = typeof value.reasoning === 'boolean' ? value.reasoning : undefined
  const vision = visionOf(value)
  const defaultEffort = thinking === true
    ? (efforts.includes('high') ? 'high' : efforts[efforts.length - 1])
    : undefined
  return {
    id,
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(vision === undefined ? {} : { vision }),
    ...(thinking === undefined ? {} : { thinking }),
    ...(defaultEffort === undefined ? {} : { defaultEffort }),
    ...(thinking === true && efforts.length > 0 ? { thinkingEfforts: efforts } : {}),
  }
}

/** Parse the opencode-go.models object out of a models.dev API document. */
export function parseOpenCodeGoModelsDev(value: unknown): OpenCodeGoModelsDevOverlay {
  const provider = isJsonRecord(value) ? value['opencode-go'] : undefined
  const models = isJsonRecord(provider) ? provider.models : undefined
  if (!isJsonRecord(models)) return new Map()
  const overlay = new Map<string, OpenCodeGoCatalogModelConfig>()
  for (const [id, row] of Object.entries(models)) {
    if (id.length === 0) continue
    const parsed = parseOpenCodeGoModelsDevRow(id, row)
    if (parsed !== undefined) overlay.set(id, parsed)
  }
  return overlay
}

async function fetchAndStore(
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<OpenCodeGoModelsDevOverlay> {
  const timeout = AbortSignal.timeout(MODELS_DEV_TIMEOUT_MS)
  const requestSignal = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
  try {
    const response = await fetchImpl(MODELS_DEV_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: requestSignal,
    })
    if (!response.ok) {
      await response.body?.cancel()
      return cache?.overlay ?? new Map()
    }
    const body = JSON.parse(await readBoundedText(
      response,
      MODELS_DEV_MAX_BYTES,
      MODELS_DEV_URL,
      'DISCOVERY_FAILED',
      requestSignal,
    )) as unknown
    const overlay = parseOpenCodeGoModelsDev(body)
    const at = Date.now()
    cache = { at, overlay }
    writeDisk(at, overlay)
    return overlay
  } catch {
    // Abort, network, HTTP, and JSON failures are non-fatal; GET /models still lists ids.
    return cache?.overlay ?? new Map()
  }
}

/** Fetch models.dev, returning an empty overlay when the document is unavailable. */
export async function loadOpenCodeGoModelsDev(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<OpenCodeGoModelsDevOverlay> {
  hydrateFromDisk()
  const now = Date.now()
  if (cache !== undefined && now - cache.at < REFRESH_AFTER_MS) return cache.overlay
  if (inflight !== undefined) return inflight
  inflight = fetchAndStore(fetchImpl, signal).finally(() => { inflight = undefined })
  if (cache !== undefined) {
    void inflight
    return cache.overlay
  }
  return await inflight
}
