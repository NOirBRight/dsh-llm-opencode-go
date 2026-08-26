/** Official OpenCode mark (opencode.ai/favicon.svg), sized for the provider card. */
import type { ReactNode } from 'react'

export function BrandMark(): ReactNode {
  return (
    <svg width={18} height={18} viewBox="128 96 256 320" aria-hidden="true" style={{ flex: 'none' }}>
      <path fill="currentColor" opacity={0.35} d="M320 224V352H192V224H320Z" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
      />
    </svg>
  )
}
