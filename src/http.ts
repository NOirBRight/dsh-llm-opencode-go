/** Byte-limited response-body reading and Host JSON/key helpers. */

import { INVALID_CREDENTIAL_CODE, LlmError, normalizeApiKey } from '@deepseek-ai/dsh-llm'
export { isJsonRecord } from './json-record.ts'

/** Normalize a stored Host credential; never used for browser-supplied secrets. */
export function requireUsableApiKey(raw: string, blankMessage: string): string {
  const checked = normalizeApiKey(raw)
  if (checked.ok) return checked.value
  throw new LlmError(
    checked.reason === 'empty'
      ? blankMessage
      : 'this provider\'s API key contains characters no HTTP header can carry; paste the raw key only',
    INVALID_CREDENTIAL_CODE,
  )
}

/** Read a response as UTF-8 without buffering more than maxBytes. */
export async function readBoundedText(
  response: Response,
  maxBytes: number,
  label: string,
  code: string,
  signal?: AbortSignal,
): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel()
    throw new LlmError(label + ' returned an oversized response', code)
  }
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  const cancelReader = (): void => { void reader.cancel() }
  signal?.addEventListener('abort', cancelReader, { once: true })
  try {
    for (;;) {
      signal?.throwIfAborted()
      const result = await reader.read()
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel()
        throw new LlmError(label + ' returned an oversized response', code)
      }
      text += decoder.decode(result.value, { stream: true })
    }
    text += decoder.decode()
    return text
  } finally {
    signal?.removeEventListener('abort', cancelReader)
    reader.releaseLock()
  }
}
