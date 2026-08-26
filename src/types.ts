/** Host-only wire types for OpenCode Go error classification. */

/** Parsed provider error body, when a non-2xx response includes JSON. */
export interface WireError {
  message?: string
  type?: string
  code?: string
}
