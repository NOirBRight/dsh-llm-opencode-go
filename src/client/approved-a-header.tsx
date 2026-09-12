/** Approved A provider header: identity, LLM badge, headline quota, status, chevron. */

import type { CSSProperties, ReactNode } from 'react'

export interface ProviderHeadlineQuota {
  remainingPercent?: number
  remainingFraction?: number
  label?: string
  detail?: string
  emptyLabel?: string
}

function normalizeQuotaRemaining(input: ProviderHeadlineQuota): number | undefined {
  const percent = input.remainingPercent
  if (percent !== undefined) return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : undefined
  const fraction = input.remainingFraction
  if (fraction !== undefined) return Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? fraction * 100 : undefined
  return undefined
}

function formatQuotaDetail(detail: string): string {
  return detail
}

const meterWrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0, minHeight: 50 }
const meterTopStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }
const meterLabelStyle: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: '18px' }
const meterValueStyle: CSSProperties = { flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' }
const meterTrackStyle: CSSProperties = { display: 'block', width: '100%', height: 6, overflow: 'hidden', border: 0, borderRadius: 2, background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)', position: 'relative' }
const meterFillBase: CSSProperties = { display: 'block', height: '100%', borderRadius: 2, position: 'relative', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 55%, var(--dsw-alias-label-secondary))' }
const meterWarnFill: CSSProperties = { background: 'var(--dsw-alias-state-warn-primary)' }
const meterKnobStyle: CSSProperties = { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: 'var(--dsw-alias-label-primary)' }
const meterSegmentsStyle: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), var(--dsw-alias-bg-layer-1) calc(10% - 1px), var(--dsw-alias-bg-layer-1) 10%)' }
const meterDetailStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const meterMissingStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: '18px' }

export function ProviderQuotaMeter(props: ProviderHeadlineQuota): ReactNode {
  const remaining = normalizeQuotaRemaining(props)
  const label = props.label ?? 'Quota'
  if (remaining === undefined) {
    return <span data-provider-quota-missing="" style={meterMissingStyle}>{props.emptyLabel ?? '—'}</span>
  }
  const warn = remaining < 20
  const text = String(remaining)
  return (
    <span data-provider-quota="" style={meterWrapStyle}>
      <span style={meterTopStyle}>
        <span style={meterLabelStyle}>{label}</span>
        <span style={meterValueStyle}>{text}%</span>
      </span>
      <span
        data-provider-quota-meter=""
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={remaining}
        style={meterTrackStyle}
      >
        <span style={{ ...meterFillBase, ...(warn ? meterWarnFill : {}), width: text + '%' }}>
          <span style={meterKnobStyle} />
        </span>
        <span aria-hidden="true" style={meterSegmentsStyle} />
      </span>
      <span style={meterDetailStyle}>{props.detail === undefined ? ' ' : formatQuotaDetail(props.detail)}</span>
    </span>
  )
}

function ProviderRoleBadge(props: { role?: 'llm' | 'agent' }): ReactNode {
  const agent = (props.role ?? 'llm') === 'agent'
  return (
    <span
      data-provider-role-badge={agent ? 'agent' : 'llm'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        fontSize: 10,
        fontWeight: 500,
        lineHeight: '16px',
        padding: '0 5px',
        borderRadius: 3,
        border: '1px solid ' + (agent ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-border-l2)'),
        color: agent ? 'var(--dsw-alias-bg-layer-1)' : 'var(--dsw-alias-label-secondary)',
        background: agent ? 'var(--dsw-alias-label-primary)' : 'transparent',
      }}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" width={12} height={12}>
        {agent
          ? (
            <>
              <rect x="1.5" y="2" width="13" height="12" rx="2" />
              <path d="m4 5 3 3-3 3m5 0h3" />
            </>
          )
          : (
            <>
              <rect x="2" y="2" width="12" height="9" rx="3" />
              <path d="m5 11-1 3 5-3M5 6h6" />
            </>
          )}
      </svg>
      {agent ? 'Agent' : 'LLM'}
    </span>
  )
}

export const PROVIDER_UI_CSS = [
  '[data-provider-card]{box-sizing:border-box;width:100%;min-width:0;list-style:none;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible}',
  '[data-provider-card-header]{box-sizing:border-box;width:100%;min-height:76px!important;display:flex;align-items:center;justify-content:space-between;gap:16px;border:0;padding:12px 14px!important;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}',
  '[data-provider-body][hidden]{display:none!important}',
  '[data-provider-role-badge] svg{width:12px;height:12px}',
  '[data-provider-card-header]:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)}',
  '[data-provider-body]{display:flex;flex-direction:column;gap:18px;border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}',
  '[data-provider-quota-mini]{display:block}',
  '[data-providers-list]{display:flex;flex-direction:column}',
  '[data-providers-list] [data-sortable-row]+[data-sortable-row]{border-top:1px solid var(--dsw-alias-border-l2)}',
  '[data-providers-section]{container-type:inline-size}',
  '@media (max-width:680px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px;height:11px}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}}',
  '@container (max-width:540px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px;height:11px}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}}',
].join('\n')

export function ensureProviderUiCss(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('dsh-provider-ui') !== null) return
  const style = document.createElement('style')
  style.id = 'dsh-provider-ui'
  style.textContent = PROVIDER_UI_CSS
  document.head.appendChild(style)
}

export function ProviderCardHeader(props: {
  title: string
  mark: ReactNode
  summary: string
  open: boolean
  unsaved?: boolean
  unsavedLabel?: string
  status?: string
  role?: 'llm' | 'agent'
  quota?: ProviderHeadlineQuota
}): ReactNode {
  ensureProviderUiCss()
  const quota = props.quota
  return (
    <span data-provider-header-main="" style={{ minHeight: 56, display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
      <span data-provider-header-identity="" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 190, flex: '1 1 190px', overflow: 'hidden' }}>
        <span data-provider-header-mark="" style={{ width: 28, height: 28, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'visible' }}>{props.mark}</span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, lineHeight: '20px', whiteSpace: 'nowrap' }}>
            <span>{props.title}</span>
            <ProviderRoleBadge {...props.role === undefined ? {} : { role: props.role }} />
          </span>
          <span data-provider-header-summary="" style={{ fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {props.summary}
          </span>
        </span>
      </span>
      {quota === undefined
        ? null
        : (
          <span data-provider-quota-mini="" style={{ flex: '1 1 210px', maxWidth: 260, minWidth: 210 }}>
            <ProviderQuotaMeter {...quota} />
          </span>
        )}
      {props.status === undefined || props.status.length === 0
        ? null
        : (
          <span data-provider-header-status="" style={{ width: 64, flex: 'none', textAlign: 'right', fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {props.status}
          </span>
        )}
      <span data-provider-header-side="" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        {props.unsaved === true && props.unsavedLabel !== undefined
          ? <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>{props.unsavedLabel}</span>
          : null}
        <span
          data-provider-header-chevron=""
          aria-hidden="true"
          style={{ width: 15, fontSize: 20, lineHeight: 1, textAlign: 'center', color: 'var(--dsw-alias-label-tertiary)', transform: props.open ? 'rotate(180deg)' : 'none' }}
        >
          ⌄
        </span>
      </span>
    </span>
  )
}
