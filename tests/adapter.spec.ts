import { describe, expect, it } from 'vitest'
import { classifyOpenCodeGoTransientError, httpErrorCode } from '../src/adapter.ts'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

function failureChunk(code: string, message: string): StreamChunk {
  return {
    type: 'finish',
    reason: { kind: 'error', failure: { code, message } },
  }
}

describe('OpenCode Go error classification', () => {
  it('keeps provider region failures out of the AUTH bucket', () => {
    const chunk = failureChunk(
      'AUTH',
      'OpenAI API error (403): {"type":"error","error":{"type":"RegionError","message":"This model is not available in your country."}}',
    )
    expect(classifyOpenCodeGoTransientError(chunk)).toMatchObject({
      reason: { kind: 'error', failure: { code: 'MODEL_UNAVAILABLE' } },
    })
  })

  it('maps structured HTTP region errors before generic 403 authentication', () => {
    expect(httpErrorCode(403, { type: 'RegionError' })).toBe('MODEL_UNAVAILABLE')
    expect(httpErrorCode(403, { type: 'AuthError' })).toBe('AUTH')
  })
})
