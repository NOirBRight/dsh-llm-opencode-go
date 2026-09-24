import { describe, expect, it } from 'vitest'
import * as Plugin from '../src/index.ts'

describe('OpenCode Go provider config validation', () => {
  it('rejects duplicate catalog model ids before a provider route is registered', () => {
    expect(() => Plugin.resolveAdapterOptions({ models: [{ id: 'duplicate' }, { id: 'duplicate' }] })).toThrow()
  })

  it('rejects invalid URLs and out-of-range runtime settings', () => {
    expect(() => Plugin.resolveAdapterOptions({ baseURL: 'file:///tmp/opencode' })).toThrow()
    expect(() => Plugin.resolveAdapterOptions({ streamIdleTimeoutMs: Number.MAX_VALUE })).toThrow()
  })
})
