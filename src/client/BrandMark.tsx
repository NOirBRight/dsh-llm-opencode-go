/** Compact OpenCode Go mark for the shared provider card. */
import type { ReactNode } from 'react'

export function BrandMark(): ReactNode {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true" style={{ flex: 'none' }}>
      <rect x="1" y="1" width="16" height="16" rx="4" fill="currentColor" opacity="0.14" />
      <path
        d="M5 12.2V5.8h2.15c1.7 0 2.7.86 2.7 2.18 0 .86-.42 1.5-1.16 1.86L10.3 12.2H8.55L7.2 9.9H6.5v2.3H5Zm1.5-3.55h.62c.8 0 1.22-.36 1.22-.94s-.42-.92-1.22-.92H6.5v1.86Z"
        fill="currentColor"
      />
      <path d="M11.2 5.8h1.55v6.4H11.2z" fill="currentColor" />
    </svg>
  )
}
