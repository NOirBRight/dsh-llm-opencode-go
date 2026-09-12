/** OpenCode Go connection and model-catalog card for Plugin configuration. */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {
  OpenCodeGoCatalogModelConfig,
  OpenCodeGoDiscoveryRequest,
  OpenCodeGoSaveResult,
  OpenCodeGoSettingsView,
  OpenCodeGoUsageView,
  OpenCodeGoUsageWindow,
} from '../client-contract.ts'

import type { OpenCodeGoSettingsKey } from './locales.ts'
import { BrandMark } from './BrandMark.tsx'
import { inputStyle, modelContentStyle, rowInputStyle } from './model-catalog-ui.tsx'
import { formatEffortName, isValidEffortForModel, openCodeGoSupportedEfforts, resolveEffectiveDefaultEffort } from '../reasoning.ts'
import { ProviderCardHeader, ProviderQuotaMeter, UsageHeader, UsageSkeleton, UsageUpdatedAt, formatUsageClock, providerHeaderStyle, resetLabelOf } from './provider-chrome.tsx'
import type { ProviderHeadlineQuota } from './provider-chrome.tsx'
import type { ProviderItemSlotContext } from 'dsh-llm-providers-ui/provider-detail'
import { peekOpenCodeGoUsageView, persistOpenCodeGoUsage, remainingPercent } from './usage-reader.ts'
import { SortableList } from 'dsh-llm-providers-ui/sortable'

/** Credential state exposed without returning the credential value. */
export interface OpenCodeGoCredentialState {
  /** Whether any Host credential layer supplies the reference. */
  configured: boolean
  /** Whether the writable credentials provider can replace it. */
  writable: boolean
}

/**
 * Answer of one usage read: the snapshot, an endpoint without a usage
 * surface, or a running Host whose plugin code predates the usage endpoint
 * (a restart loads it; the card says so instead of showing an error).
 */
export type OpenCodeGoUsageRead =
  | { kind: 'ok', usage: OpenCodeGoUsageView }
  | { kind: 'unsupported' }
  | { kind: 'needs-restart' }

/** Dependencies injected by the browser-plugin registration. */
export interface OpenCodeGoPluginCardFace {
  /** Localized card copy. */
  t: (key: OpenCodeGoSettingsKey) => string
  hooks: {
    /** Reactive Host-owned settings section. */
    openCodeGoSettings: SettingsScope<OpenCodeGoSettingsView>
  }
  /** Read value-free credential status for the section's reference. */
  describeCredential: () => Promise<OpenCodeGoCredentialState>
  /** Persist a typed key through the credentials API before Host reads. */
  storeApiKey: (apiKey: string) => Promise<void>
  /** Atomically store changed settings and return the accepted Host snapshot. */
  saveConfiguration: (settings: OpenCodeGoSettingsView, apiKey?: string) => Promise<OpenCodeGoSaveResult>
  /** Ask Host to list models using the stored credential. */
  discoverModels: (request: OpenCodeGoDiscoveryRequest) => Promise<readonly OpenCodeGoCatalogModelConfig[]>
  /** Ask Host to read usage using the stored credential. */
  fetchUsage: (request: OpenCodeGoDiscoveryRequest) => Promise<OpenCodeGoUsageRead>
  /** Open the frame-level picker immediately with the current selected ids. */
  beginModelPicker: (initiallyPicked: ReadonlySet<string>, onAdopt: (models: readonly OpenCodeGoCatalogModelConfig[]) => void) => void
  /** Populate the open picker with discovered candidates. */
  completeModelPicker: (candidates: readonly OpenCodeGoCatalogModelConfig[]) => void
  /** Show a discovery failure in the open picker. */
  failModelPicker: (message: string) => void
  /** Close a picker whose owning settings card unmounts. */
  closeModelPicker: () => void
}

/** Props delivered by the Plugin configuration item slot. */
export type OpenCodeGoPluginCardProps =
  PropsRuntime<'settings.provider.item'>
  & InjectFace<OpenCodeGoPluginCardFace>
  // Present only on the settings page; an older host renders the legacy card.
  & Partial<ProviderItemSlotContext>

interface ModelDraft {
  /** Client-only stable identity; stripped before settings are saved. */
  rowId: string
  id: string
  name?: string
  description?: string
  contextWindow: string
  vision?: boolean
  thinking?: boolean
  defaultEffort?: string
  thinkingEfforts?: string[]
  tools?: boolean
}

interface Draft {
  baseURL: string
  models: ModelDraft[]
}

type ModelPatch = {
  [Key in keyof ModelDraft]?: ModelDraft[Key] | undefined
}

type UsageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready', usage: OpenCodeGoUsageView }
  | { status: 'unsupported' }
  | { status: 'needs-restart' }
  | { status: 'error', message: string }

const cardStyle: CSSProperties = {
  overflow: 'hidden',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-module-platform)',
}
const headerStyle = providerHeaderStyle
const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  padding: '16px 14px 18px',
}
const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }
const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)',
}
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const labelStyle: CSSProperties = { fontSize: 13, color: 'var(--dsw-alias-label-secondary)' }
const hintStyle: CSSProperties = { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }
// catalog visuals are imported from ./model-catalog-ui.tsx
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }
const buttonStyle: CSSProperties = {
  minHeight: 34,
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 18,
  padding: '6px 14px',
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  cursor: 'pointer',
}
const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: 'var(--dsw-alias-button-primary-fill)',
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}
const iconButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  border: 0,
  borderRadius: 6,
  padding: 0,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  font: 'inherit',
  cursor: 'pointer',
}
const disclosureStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}
// modelDetailStyle / capabilitiesStyle imported
const statusStyle: CSSProperties = { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' }
const errorStyle: CSSProperties = { ...statusStyle, color: 'var(--dsw-alias-state-error-primary)' }
const usageListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

let nextModelRow = 0

/** Stable client-only row identity used by the pointer sortable preview. */
function newModelRowId(): string {
  nextModelRow += 1
  return 'opencode-go-model-row-' + String(nextModelRow)
}

function effortRow(id: string, thinkingEfforts: string[] | undefined): Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking' | 'thinkingEfforts'> {
  return thinkingEfforts === undefined
    ? { id, thinking: true }
    : { id, thinking: true, thinkingEfforts }
}

function modelDraftOf(model: OpenCodeGoCatalogModelConfig): ModelDraft {
  return {
    rowId: newModelRowId(),
    ...model,
    contextWindow: model.contextWindow === undefined ? '' : String(model.contextWindow),
    ...model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort },
  }
}

function draftOf(settings: OpenCodeGoSettingsView): Draft {
  return {
    baseURL: settings.baseURL,
    models: settings.models.map(modelDraftOf),
  }
}

/** Same K/M spelling as Settings → Models: `1m` → 1000000, `256k` → 256000. */
function integerOf(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  const match = /^(\d+(?:\.\d+)?)([km])?$/iu.exec(trimmed)
  if (match === null || match[1] === undefined) return Number.NaN
  const suffix = match[2]?.toLowerCase()
  const scale = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1
  const scaled = Number(match[1]) * scale
  const rounded = Math.round(scaled)
  const value = Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled
  return Number.isSafeInteger(value) && value > 0 ? value : Number.NaN
}

function validURL(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function sameDraft(left: Draft, right: Draft): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function modelSettingsOf(draft: ModelDraft): OpenCodeGoCatalogModelConfig {
  const { rowId: _rowId, contextWindow: contextText, tools: _tools, ...model } = draft
  const contextWindow = integerOf(contextText)
  return {
    ...model,
    id: model.id.trim(),
    ...contextWindow === undefined ? {} : { contextWindow },
  }
}

function settingsOf(draft: Draft, current: OpenCodeGoSettingsView): OpenCodeGoSettingsView {
  return {
    ...current,
    baseURL: draft.baseURL.trim(),
    models: draft.models.map(modelSettingsOf),
  }
}

function modelFailure(models: readonly ModelDraft[]): boolean {
  const ids = new Set<string>()
  for (const model of models) {
    const id = model.id.trim()
    if (id.length === 0 || ids.has(id)) return true
    ids.add(id)
    if (Number.isNaN(integerOf(model.contextWindow))) return true
  }
  return false
}

function usageErrorOf(error: unknown, t: (key: OpenCodeGoSettingsKey) => string): string {
  const raw = messageOf(error, t('requestFailed'))
  return /failed to fetch|could not reach|network|enotfound|econnreset|econnrefused|etimedout/i.test(raw)
    ? t('usageUnreachable')
    : raw
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

/** Expansion-state key that survives id edits and preview reorders. */
function rowKeyOf(model: ModelDraft): string {
  return model.rowId
}

/** One capability checkbox. */

/** Disclosure chevron; rotates to point down while open. */
function IconChevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden
      style={{ flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}
    >
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Removal glyph for one model row. */
function IconTrash(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4M6.5 6.8v4.4M9.5 6.8v4.4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function usageResetCopy(t: OpenCodeGoPluginCardFace['t']): { at: string, atDays: string } {
  return { at: t('usageResetAt'), atDays: t('usageResetAtDays') }
}

function resetDetail(
  iso: string | undefined,
  t: OpenCodeGoPluginCardFace['t'],
  fallback?: string,
): string | undefined {
  return resetLabelOf(iso, usageResetCopy(t)) ?? fallback
}

function headlineQuota(
  usage: UsageState,
  lastUsage: OpenCodeGoUsageView | undefined,
  t: OpenCodeGoPluginCardFace['t'],
): ProviderHeadlineQuota | undefined {
  const view = usage.status === 'ready' ? usage.usage : lastUsage
  const weekly = view?.weekly
  const monthly = view?.monthly
  const session = view?.session
  const window = weekly ?? monthly ?? session
  if (window !== undefined) {
    const label = weekly !== undefined ? t('usageWeekly') : monthly !== undefined ? t('usageMonthly') : t('usageSession')
    return {
      label,
      remainingPercent: remainingPercent(window.usage),
      ...(() => {
        const detail = resetDetail(window.resetsAt, t)
        return detail === undefined ? {} : { detail }
      })(),
    }
  }
  if (usage.status === 'error' || usage.status === 'unsupported') return { label: t('usage') }
  return undefined
}

/** One quota window in remaining-percent Approved A meter language. */
function UsageBar({ label, window: quota, t, fallbackReset }: {
  label: string
  window: OpenCodeGoUsageWindow
  t: OpenCodeGoPluginCardFace['t']
  fallbackReset?: string
}): ReactNode {
  const detail = resetDetail(quota.resetsAt, t, fallbackReset)
  return (
    <ProviderQuotaMeter
      label={label}
      remainingPercent={remainingPercent(quota.usage)}
      {...detail === undefined ? {} : { detail }}
    />
  )
}

/** Render the single-package OpenCode Go contribution under Plugin configuration. */
export function OpenCodeGoPluginCard(props: OpenCodeGoPluginCardProps): ReactNode {
  const { t } = props
  const snapshot = props.useOpenCodeGoSettings((value: OpenCodeGoSettingsView) => value)
  const [open, setOpen] = useState(false)
  const initial = useMemo(() => snapshot.value === undefined ? undefined : draftOf(snapshot.value), [snapshot.value])
  const [source, setSource] = useState<Draft | undefined>(initial)
  const [draft, setDraft] = useState<Draft | undefined>(initial)
  const [sourceRevision, setSourceRevision] = useState<number | undefined>(snapshot.revision)
  const [apiKey, setApiKey] = useState('')
  const [credential, setCredential] = useState<OpenCodeGoCredentialState | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const cachedUsage = peekOpenCodeGoUsageView()
  const [usage, setUsage] = useState<UsageState>(cachedUsage === undefined ? { status: 'idle' } : { status: 'ready', usage: cachedUsage })
  const [lastUsage, setLastUsage] = useState<OpenCodeGoUsageView | undefined>(cachedUsage)
  const [usageUpdatedAt, setUsageUpdatedAt] = useState<Date | undefined>(undefined)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [modelSorting, setModelSorting] = useState(false)
  const [expandedModels, setExpandedModels] = useState<ReadonlySet<string>>(new Set())
  const dirty = source !== undefined && draft !== undefined && (!sameDraft(source, draft) || apiKey.length > 0)

  useEffect(() => {
    if (snapshot.status !== 'ready' || snapshot.value === undefined) return
    if (snapshot.revision === sourceRevision) return
    if (dirty) return
    const next = draftOf(snapshot.value)
    setSource(next)
    setDraft(next)
    setSourceRevision(snapshot.revision)
  }, [dirty, snapshot.revision, snapshot.status, snapshot.value, sourceRevision])

  const refreshCredential = async (): Promise<void> => {
    try {
      setCredential(await props.describeCredential())
    } catch {
      setCredential(undefined)
    }
  }
  useEffect(() => {
    if (snapshot.status !== 'ready') return
    void refreshCredential()
  }, [snapshot.status, snapshot.value?.apiKeyEnv])
  useEffect(() => () => { props.closeModelPicker() }, [props.closeModelPicker])

  if (snapshot.status === 'unavailable') {
    return (
      <li style={cardStyle} data-provider-card="" data-provider-role="llm">
        <button
          type="button"
          style={headerStyle}
          data-provider-card-header=""
          aria-expanded={open}
          aria-label={t(open ? 'collapse' : 'expand') + ': ' + t('title')}
          onClick={() => { setOpen(!open) }}
        >
          <ProviderCardHeader
            title={t('title')}
            mark={<BrandMark />}
            summary={t('summaryModels').replace('{count}', '0')}
            status={t('summaryOff')}
            role="llm"
            open={open}
          />
        </button>
        {open
          ? (
            <div style={bodyStyle} data-provider-body="">
              <p style={statusStyle} role="status">{t('remoteAccess')}</p>
            </div>
          )
          : null}
      </li>
    )
  }
  const title = t('title')
  const disabled = snapshot.status !== 'ready' || !snapshot.writable || busy
  const keyInvalid = apiKey.length > 0 && apiKey.trim().length === 0
  const customModels = snapshot.user !== undefined
    && Object.prototype.hasOwnProperty.call(snapshot.user, 'models')
  const invalid = draft !== undefined && (
    !validURL(draft.baseURL.trim()) || modelFailure(draft.models) || keyInvalid
  )

  const patchDraft = (next: Partial<Draft>): void => {
    setDraft(current => current === undefined ? current : { ...current, ...next })
    setFailure(undefined)
    setNotice(undefined)
  }
  const patchModel = (index: number, patch: ModelPatch): void => {
    if (draft === undefined) return
    patchDraft({
      models: draft.models.map((model, at) => {
        if (at !== index) return model
        const next: ModelDraft = { ...model }
        if (patch.id !== undefined) {
          next.id = patch.id
          if (next.thinking === true && next.defaultEffort !== undefined && !isValidEffortForModel(effortRow(next.id, next.thinkingEfforts), next.defaultEffort)) {
            const fallback = resolveEffectiveDefaultEffort({ ...effortRow(next.id, next.thinkingEfforts), defaultEffort: next.defaultEffort })
              ?? resolveEffectiveDefaultEffort(effortRow(next.id, next.thinkingEfforts))
            if (fallback !== undefined) next.defaultEffort = fallback
            else delete next.defaultEffort
          }
        }
        if ('name' in patch) {
          if (patch.name === undefined) delete next.name
          else next.name = patch.name
        }
        if ('description' in patch) {
          if (patch.description === undefined) delete next.description
          else next.description = patch.description
        }
        if (patch.contextWindow !== undefined) next.contextWindow = patch.contextWindow
        if ('vision' in patch) {
          if (patch.vision === undefined) delete next.vision
          else next.vision = patch.vision
        }
        if ('thinking' in patch) {
          if (patch.thinking === undefined) delete next.thinking
          else next.thinking = patch.thinking
          if (patch.thinking !== true) delete next.defaultEffort
          else if (next.defaultEffort === undefined || !isValidEffortForModel(effortRow(next.id, next.thinkingEfforts), next.defaultEffort)) {
            const fallback = resolveEffectiveDefaultEffort(effortRow(next.id, next.thinkingEfforts))
            if (fallback !== undefined) next.defaultEffort = fallback
            else delete next.defaultEffort
          }
        }
        if ('defaultEffort' in patch) {
          if (patch.defaultEffort === undefined) delete next.defaultEffort
          else next.defaultEffort = patch.defaultEffort
        }
        return next
      }),
    })
  }
  const removeModel = (index: number): void => {
    if (draft === undefined) return
    patchDraft({ models: draft.models.filter((_, at) => at !== index) })
  }
  const toggleModel = (key: string): void => {
    setExpandedModels((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  const loadUsage = async (): Promise<void> => {
    // The settings page owns quota in the shared detail; the card self-loads only in the legacy layout.
    if (props.mode === 'detail') return
    if (peekOpenCodeGoUsageView() === undefined) setUsage({ status: 'loading' })
    try {
      if (apiKey.trim().length > 0) {
        await props.storeApiKey(apiKey.trim())
        await refreshCredential()
      }
      const read = await props.fetchUsage({
        ...draft === undefined ? {} : { baseURL: draft.baseURL.trim() },
      })
      if (read.kind === 'ok') {
        setLastUsage(read.usage)
        persistOpenCodeGoUsage(read.usage)
        setUsageUpdatedAt(new Date())
      }
      setUsage(
        read.kind === 'ok'
          ? { status: 'ready', usage: read.usage }
          : read.kind === 'needs-restart'
            ? { status: 'needs-restart' }
            : { status: 'unsupported' },
      )
    } catch (error: unknown) {
      setUsage({ status: 'error', message: usageErrorOf(error, t) })
    }
  }
  useEffect(() => {
    if (snapshot.status !== 'ready') return
    if (credential?.configured !== true) return
    void loadUsage()
  }, [snapshot.status, credential?.configured])

  const fetchModels = async (): Promise<void> => {
    if (draft === undefined) return
    const currentModels = draft.models.map(modelSettingsOf)
    const initiallyPicked = new Set(currentModels.map(model => model.id))
    setFetching(true)
    setFailure(undefined)
    setNotice(undefined)
    props.beginModelPicker(initiallyPicked, selected => {
      setDraft(current => {
        if (current === undefined) return current
        const currentById = new Map(current.models.map(model => [model.id.trim(), model]))
        const next = new Map<string, ModelDraft>()
        for (const candidate of selected) {
          const existing = currentById.get(candidate.id)
          const discovered = modelDraftOf(candidate)
          next.set(candidate.id, existing === undefined
            ? discovered
            : { ...existing, ...discovered, rowId: existing.rowId })
        }
        return { ...current, models: [...next.values()] }
      })
      setCatalogOpen(true)
      setFailure(undefined)
      setNotice(undefined)
    })
    try {
      if (apiKey.trim().length > 0) {
        await props.storeApiKey(apiKey.trim())
        await refreshCredential()
      }
      const found = await props.discoverModels({
        baseURL: draft.baseURL.trim(),
      })
      if (found.length === 0) {
        const message = t('fetchEmpty')
        props.failModelPicker(message)
        setFailure(message)
        return
      }
      const foundIds = new Set(found.map(model => model.id))
      const currentOnly = currentModels.filter(model => !foundIds.has(model.id))
      props.completeModelPicker([...found, ...currentOnly])
    } catch (error: unknown) {
      const message = messageOf(error, t('requestFailed'))
      props.failModelPicker(message)
      setFailure(message)
    } finally {
      setFetching(false)
    }
  }

  const discard = (): void => {
    if (source !== undefined) setDraft(structuredClone(source))
    setApiKey('')
    setFailure(undefined)
    setNotice(undefined)
  }

  const save = async (): Promise<void> => {
    if (draft === undefined || snapshot.value === undefined || invalid) return
    setBusy(true)
    setFailure(undefined)
    setNotice(undefined)
    try {
      const settings = settingsOf(draft, snapshot.value)
      const accepted = await props.saveConfiguration(settings, apiKey.trim().length === 0 ? undefined : apiKey.trim())
      const next = draftOf(accepted.settings)
      setSource(next)
      setDraft(next)
      setSourceRevision(accepted.revision)
      setApiKey('')
      setNotice(t('saved'))
      void refreshCredential()
      void loadUsage()
    } catch (error: unknown) {
      setFailure(messageOf(error, t('requestFailed')))
    } finally {
      setBusy(false)
    }
  }

  let validation: string | undefined
  if (draft !== undefined && !validURL(draft.baseURL.trim())) validation = t('invalidBaseURL')
  else if (draft !== undefined && modelFailure(draft.models)) validation = t('invalidModel')
  else if (keyInvalid) validation = t('invalidApiKey')

  const headerCount = t('summaryModels').replace('{count}', String(draft?.models.length ?? 0))
  const headerStatus = credential?.configured === true ? t('summaryOn') : t('summaryOff')
  const headerQuota = headlineQuota(usage, lastUsage, t)

  // Prototype C pieces, shared by the legacy card and the migrated detail.
  const modelsList = (
    <>
                          <SortableList
                            items={draft?.models ?? []}
                            getId={model => model.rowId}
                            disabled={disabled}
                            dragLabel={(model, index) => {
                              const label = model.id.trim().length > 0 ? model.id.trim() : String(index + 1)
                              return t('dragModel') + ': ' + label
                            }}
                            onReorder={(models) => { patchDraft({ models }) }}
                            renderItem={(model, index) => {
                              const key = rowKeyOf(model)
                              const expanded = expandedModels.has(key)
                              const label = model.id.trim().length > 0 ? model.id.trim() : String(index + 1)
                              return (
                                <div data-model-row={label} style={modelContentStyle}>
                                  <input
                                    style={rowInputStyle}
                                    value={model.id}
                                    placeholder={t('modelId')}
                                    aria-label={t('modelId') + ' ' + String(index + 1)}
                                    disabled={disabled}
                                    onChange={(event) => { patchModel(index, { id: event.target.value }) }}
                                  />
                                  <input
                                    style={rowInputStyle}
                                    value={model.name ?? ''}
                                    placeholder={t('modelName')}
                                    aria-label={t('modelName') + ' ' + String(index + 1)}
                                    disabled={disabled}
                                    onChange={(event) => { patchModel(index, { name: event.target.value || undefined }) }}
                                  />
                                  <button
                                    type="button"
                                    style={iconButtonStyle}
                                    aria-label={t('modelDetails') + ': ' + label}
                                    aria-expanded={expanded}
                                    title={t('modelDetails')}
                                    onClick={() => { toggleModel(key) }}
                                  >
                                    <IconChevron open={expanded} />
                                  </button>
                                  <button
                                    type="button"
                                    style={iconButtonStyle}
                                    aria-label={t('remove') + ' ' + label}
                                    title={t('remove')}
                                    disabled={disabled}
                                    onClick={() => { removeModel(index) }}
                                  >
                                    <IconTrash />
                                  </button>
                                   {expanded ? modelExtra(model, index) : null}
                                </div>
                              )
                            }}
                          />
                          <button
                            type="button"
                            style={{ ...buttonStyle, alignSelf: 'flex-start' }}
                            disabled={disabled}
                            onClick={() => {
                              const model: ModelDraft = { rowId: newModelRowId(), id: '', contextWindow: '' }
                              patchDraft({ models: [...draft?.models ?? [], model] })
                              setExpandedModels(current => new Set(current).add(model.rowId))
                            }}
                          >
                            {t('addModel')}
                          </button>
    </>
  )
  const accountFields = (
    <>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>{t('apiKey')}</span>
                      <input
                        style={inputStyle}
                        type="password"
                        aria-label={t('apiKey')}
                        autoComplete="off"
                        value={apiKey}
                        placeholder={credential?.configured ? t('apiKeyReplace') : t('apiKeyPlaceholder')}
                        disabled={busy || credential?.writable === false}
                        onChange={(event) => { setApiKey(event.target.value); setFailure(undefined); setNotice(undefined) }}
                      />
                      <span style={hintStyle}>
                        {apiKey.length > 0
                          ? t('apiKeyPending')
                          : credential?.configured
                            ? t('summaryOn')
                            : t('apiKeyUnset')}
                      </span>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>{t('baseURL')}</span>
                      <input
                        style={inputStyle}
                        type="url"
                        aria-label={t('baseURL')}
                        value={draft?.baseURL ?? ''}
                        disabled={disabled}
                        onChange={(event) => { patchDraft({ baseURL: event.target.value }) }}
                      />
                      <span style={hintStyle}>{t('baseURLHint')}</span>
                    </label>
    </>
  )
  const draftBlock = (
    <>
            {validation === undefined ? null : <p style={errorStyle}>{validation}</p>}
            {failure === undefined ? null : <p style={errorStyle}>{failure}</p>}
            {notice === undefined ? null : <p style={statusStyle}>{notice}</p>}
            <div style={actionsStyle}>
              <button type="button" style={buttonStyle} disabled={!dirty || busy} onClick={discard}>{t('discard')}</button>
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={!dirty || invalid || disabled}
                onClick={() => { void save() }}
              >
                {t(busy ? 'saving' : 'save')}
              </button>
            </div>
    </>
  )


  /** Provider-specific fields for one expanded model row; shared by both layouts. */
  const modelExtra = (model: ModelDraft, index: number): ReactNode => (
    <div className="c-extra-grid">
      <label className="c-field">
        <span className="c-field-label">{t('modelContext')}</span>
        <input
          className="c-input"
          inputMode="numeric"
          value={model.contextWindow}
          disabled={disabled}
          aria-label={t('modelContext')}
          onChange={(event) => { patchModel(index, { contextWindow: event.target.value }) }}
        />
      </label>
      <div className="c-extra-checks">
        <label>
          <input type="checkbox" checked={model.vision === true} disabled={disabled} onChange={(event) => { patchModel(index, { vision: event.target.checked }) }} />
          {t('vision')}
        </label>
        <label>
          <input type="checkbox" checked={model.thinking === true} disabled={disabled} onChange={(event) => { patchModel(index, { thinking: event.target.checked }) }} />
          {t('thinking')}
        </label>
      </div>
      {model.thinking === true
        ? (
          <label className="c-field">
            <span className="c-field-label">{t('defaultEffort')}</span>
            <select
              className="c-input"
              value={resolveEffectiveDefaultEffort(model) ?? ''}
              disabled={disabled}
              onChange={(event) => { patchModel(index, { defaultEffort: event.target.value || undefined }) }}
              aria-label={t('defaultEffort')}
            >
              {openCodeGoSupportedEfforts(effortRow(model.id, model.thinkingEfforts)).map(level => (
                <option key={level} value={level}>{formatEffortName(level)}</option>
              ))}
            </select>
          </label>
        )
        : null}
    </div>
  )

  // Prototype C detail: the shared template owns the layout, this card owns OpenCode Go's data.
  const SharedDetail = props.template
  const detailCopy = props.copy
  if (props.mode === 'detail' && SharedDetail !== undefined && detailCopy !== undefined && draft !== undefined) {
    const configured = credential?.configured === true
    return (
        <SharedDetail
          name={title}
          role="llm"
          mark={<BrandMark />}
          copy={detailCopy}
          notice={t('description')}
          account={{
            state: configured ? 'configured' : 'unconnected',
            label: configured ? t('summaryOn') : t('apiKeyUnset'),
            body: accountFields,
          }}
          quota={{
            status: props.usage?.status ?? 'loading',
            windows: props.usage?.windows ?? [],
            ...(props.onRefresh === undefined ? {} : { onRefresh: props.onRefresh }),
          }}
          models={{
            count: draft.models.length,
            allOpen: catalogOpen,
            onToggleAll: () => { setCatalogOpen(value => !value) },
            sorting: modelSorting,
            onToggleSorting: () => { setModelSorting(current => !current) },
            sortDisabled: disabled || draft.models.length < 2,
            onChooseFromAccount: () => { void fetchModels() },
            chooseDisabled: fetching || invalid || snapshot.status !== 'ready',
            items: draft.models.map(model => ({
              rowId: model.rowId,
              id: model.id,
              ...(model.name === undefined ? {} : { name: model.name }),
            })),
            expanded: [...expandedModels],
            onPatch: (rowId, patch) => {
              const index = draft.models.findIndex(model => model.rowId === rowId)
              if (index >= 0) patchModel(index, patch)
            },
            onRemove: (rowId) => {
              const index = draft.models.findIndex(model => model.rowId === rowId)
              if (index >= 0) removeModel(index)
            },
            onToggle: (rowId) => { toggleModel(rowId) },
            onReorder: (rowIds) => {
              const byId = new Map(draft.models.map(model => [model.rowId, model]))
              const next = rowIds.map(rowId => byId.get(rowId)).filter((model): model is ModelDraft => model !== undefined)
              if (next.length === draft.models.length) patchDraft({ models: next })
            },
            onAdd: () => {
              const model: ModelDraft = { rowId: newModelRowId(), id: '', contextWindow: '' }
              patchDraft({ models: [...draft.models, model] })
              setExpandedModels(current => new Set(current).add(model.rowId))
            },
            addDisabled: disabled,
            extra: (row) => {
              const index = draft.models.findIndex(model => model.rowId === row.rowId)
              const model = draft.models[index]
              return index < 0 || model === undefined ? null : modelExtra(model, index)
            },
          }}
          draft={draftBlock}
        />
    )
  }

  return (
    <li style={cardStyle} data-provider-card="" data-provider-role="llm">
      <button
        type="button"
        style={headerStyle}
        data-provider-card-header=""
        aria-expanded={open}
        aria-label={t(open ? 'collapse' : 'expand') + ': ' + title}
        onClick={() => { setOpen(!open) }}
      >
        <ProviderCardHeader
          title={title}
          mark={<BrandMark />}
          summary={headerCount}
          status={headerStatus}
          role="llm"
          {...headerQuota === undefined ? {} : { quota: headerQuota }}
          open={open}
          unsaved={dirty}
          unsavedLabel={t('unsaved')}
        />
      </button>
      {open
        ? (
          <div style={bodyStyle} data-provider-body="">
            {snapshot.status === 'loading' ? <p style={statusStyle}>{t('loading')}</p> : null}
            {snapshot.status === 'ready' && !snapshot.writable ? <p style={statusStyle}>{t('readOnly')}</p> : null}
            {draft === undefined
              ? null
              : (
                <>
                  <section style={sectionStyle}>
                    <h3 style={sectionTitleStyle}>{t('connection')}</h3>
                    {accountFields}
                  </section>

                  <section style={sectionStyle} aria-label={t('usage')}>
                    <UsageHeader
                      title={t('usage')}
                      spinning={usage.status === 'loading'}
                      disabled={usage.status === 'loading' || snapshot.status !== 'ready'}
                      refreshLabel={t('usageRefresh')}
                      busyLabel={t('usageLoading')}
                      {...usage.status === 'error' ? { error: t('usageRefreshFailed') } : {}}
                      onRefresh={() => { void loadUsage() }}
                    />
                    {(() => {
                      if (usage.status === 'idle') {
                        return <p style={hintStyle}>{t('usageIdle')}</p>
                      }
                      if (usage.status === 'loading') {
                        const known = lastUsage === undefined
                          ? 2
                          : Number(lastUsage.session !== undefined) + Number(lastUsage.weekly !== undefined) + Number(lastUsage.monthly !== undefined)
                        return <UsageSkeleton rows={known > 0 ? known : 2} />
                      }
                      const bars = usage.status === 'ready' ? usage.usage : lastUsage
                      if (bars !== undefined) {
                        return (
                        <>
                          {bars.session === undefined
                            ? null
                            : (
                              <UsageBar
                                label={t('usageSession')}
                                window={bars.session}
                                t={t}
                                fallbackReset={t('usageResetEveryHours').replace('{count}', '5')}
                              />
                            )}
                          {bars.weekly === undefined
                            ? null
                            : (
                              <UsageBar
                                label={t('usageWeekly')}
                                window={bars.weekly}
                                t={t}
                                fallbackReset={t('usageResetEveryDays').replace('{count}', '7')}
                              />
                            )}
                          {bars.monthly === undefined
                            ? null
                            : (
                              <UsageBar
                                label={t('usageMonthly')}
                                window={bars.monthly}
                                t={t}
                                fallbackReset={t('usageResetEveryDays').replace('{count}', '30')}
                              />
                            )}
                          {bars.weekly !== undefined && bars.weekly.models.length > 0
                            ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={labelStyle}>{t('usageModels')}</span>
                                <ul style={usageListStyle} aria-label={t('usageModels')}>
                                  {bars.weekly.models.map(model => (
                                    <li
                                      key={model.name}
                                      style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}
                                    >
                                      <span style={{ ...hintStyle, color: 'var(--dsw-alias-label-secondary)', overflowWrap: 'anywhere' }}>
                                        {model.name}
                                      </span>
                                      <span style={{ ...hintStyle, flex: 'none' }}>{model.requestCount} {t('usageRequests')}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                            : null}
                        </>
                      )
                      }
                      if (usage.status === 'unsupported') return <p style={hintStyle}>{t('usageUnsupported')}</p>
                      if (usage.status === 'needs-restart') return <p style={hintStyle}>{t('usageNeedsRestart')}</p>
                      if (usage.status === 'error') return <p style={errorStyle}>{usage.message}</p>
                      return <UsageSkeleton rows={2} />
                    })()}
                    <UsageUpdatedAt
                      at={usageUpdatedAt}
                      label={usageUpdatedAt === undefined ? '' : t('usageUpdatedAt').replace('{time}', formatUsageClock(usageUpdatedAt))}
                    />
                  </section>

                  <section style={sectionStyle} aria-label={t('models')}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <button
                        type="button"
                        style={disclosureStyle}
                        aria-expanded={catalogOpen}
                        aria-label={t('models')}
                        onClick={() => { setCatalogOpen(!catalogOpen) }}
                      >
                        <IconChevron open={catalogOpen} />
                        <span style={sectionTitleStyle}>{t('models')}</span>
                        <span style={hintStyle}>{customModels ? t('customized') : t('inherited')}</span>
                      </button>
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={fetching || invalid || snapshot.status !== 'ready'}
                        onClick={() => { void fetchModels() }}
                      >
                        {t(fetching ? 'fetchingModels' : 'fetchModels')}
                      </button>
                    </div>
                    {catalogOpen ? modelsList : null}
                  </section>
                </>
              )}

            {draftBlock}
          </div>
        )
        : null}
    </li>
  )
}