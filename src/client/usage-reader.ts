/** Provider Directory quota reader so OpenCode Go usage is cached and shown in the task panel. */

import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import {
  decodeOpenCodeGoUsageReply,
  decodeOpenCodeGoUsageView,
  OPENCODE_GO_ENTRY_ID,
  OPENCODE_GO_RPC_ENDPOINT,
  OPENCODE_GO_USAGE_ENDPOINT,
} from '../client-contract.ts'
import { resetLabelOf } from './provider-chrome.tsx'
import type { OpenCodeGoUsageView } from '../client-contract.ts'

const VIEW_CACHE_KEY = 'dsh-llm-opencode-go:usage-view'
let memoryView: OpenCodeGoUsageView | undefined

export interface OpenCodeGoUsageWindowSummary {
  id: string
  label: string
  shortLabel: string
  remainingPercent?: number
  valueText: string
  resetsAt?: string
}

export interface OpenCodeGoUsageReader {
  providerKey: string
  name: string
  read(
    rpc: ClientConnectionRpc,
    refresh: boolean,
    signal: AbortSignal,
  ): Promise<
    | { status: 'ready', fetchedAt: string, windows: readonly OpenCodeGoUsageWindowSummary[] }
    | { status: 'logged-out' }
    | { status: 'unsupported' }
    | { status: 'error', message?: string }
  >
}

const WINDOWS_EN = [
  { id: 'session', label: '5-hour window', shortLabel: '5h' },
  { id: 'weekly', label: 'Weekly window', shortLabel: 'W' },
  { id: 'monthly', label: 'Monthly window', shortLabel: 'M' },
] as const

const WINDOWS_ZH = [
  { id: 'session', label: '5 小时窗口', shortLabel: '5h' },
  { id: 'weekly', label: '每周额度', shortLabel: 'W' },
  { id: 'monthly', label: '每月额度', shortLabel: 'M' },
] as const

function uiZh(): boolean {
  const lang = typeof document === 'undefined' ? '' : document.documentElement.lang
  return lang.toLowerCase().startsWith('zh')
}

export function remainingPercent(used: number): number {
  return Math.max(0, Math.min(100, Math.round((1 - used) * 1000) / 10))
}

export function clearOpenCodeGoUsageCacheForTests(): void {
  memoryView = undefined
  try {
    globalThis.sessionStorage?.removeItem(VIEW_CACHE_KEY)
    globalThis.localStorage?.removeItem(VIEW_CACHE_KEY)
  } catch { /* private mode */ }
}

export function peekOpenCodeGoUsageView(): OpenCodeGoUsageView | undefined {
  if (memoryView !== undefined) return memoryView
  try {
    const raw = globalThis.sessionStorage?.getItem(VIEW_CACHE_KEY) ?? globalThis.localStorage?.getItem(VIEW_CACHE_KEY)
    if (raw === null || raw === undefined) return undefined
    const parsed = decodeOpenCodeGoUsageView(JSON.parse(raw))
    if (parsed === undefined) return undefined
    memoryView = parsed
    return parsed
  } catch {
    return undefined
  }
}

function windowsOf(view: OpenCodeGoUsageView): OpenCodeGoUsageWindowSummary[] {
  const zh = uiZh()
  const windows: OpenCodeGoUsageWindowSummary[] = []
  for (const meta of zh ? WINDOWS_ZH : WINDOWS_EN) {
    const window = view[meta.id]
    if (window === undefined) continue
    const remaining = remainingPercent(window.usage)
    const resetsAt = resetLabelOf(window.resetsAt, zh
      ? { at: '重置时间：{time}', atDays: '重置时间：{date}（还剩 {count} 天）' }
      : { at: 'Resets {time}', atDays: 'Usage limits reset on {date} ({count} days left)' })
    windows.push({
      id: meta.id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      remainingPercent: remaining,
      valueText: String(remaining) + '%',
      ...resetsAt === undefined ? {} : { resetsAt },
    })
  }
  return windows
}

/**
 * Persist a decoded usage view for this card's legacy first paint.
 * Writes only the plugin-private view cache, never the store-owned shared quota cache.
 * @param view - decoded Host usage snapshot.
 */
export function persistOpenCodeGoUsage(view: OpenCodeGoUsageView): void {
  memoryView = view
  try {
    const raw = JSON.stringify(view)
    globalThis.sessionStorage?.setItem(VIEW_CACHE_KEY, raw)
    globalThis.localStorage?.setItem(VIEW_CACHE_KEY, raw)
  } catch { /* quota / private mode */ }
}

export function createOpenCodeGoUsageReader(): OpenCodeGoUsageReader {
  return {
    providerKey: OPENCODE_GO_ENTRY_ID,
    name: 'OpenCode Go',
    async read(rpc, _refresh, signal) {
      const result = await rpc.call('/api', OPENCODE_GO_RPC_ENDPOINT, { endpoint: OPENCODE_GO_USAGE_ENDPOINT, payload: {} }, signal)
      if (!result.ok) return { status: 'error', message: result.error.message }
      const reply = decodeOpenCodeGoUsageReply(result.value)
      if (reply === undefined) return { status: 'error', message: 'Invalid OpenCode Go usage response' }
      if (reply.status !== 'ok') return { status: 'unsupported' }
      persistOpenCodeGoUsage(reply.usage)
      return { status: 'ready', fetchedAt: reply.usage.fetchedAt, windows: windowsOf(reply.usage) }
    },
  }
}
