import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

describe('published runtime artifacts', () => {
  it('exports the Host contract and alpha remoteManagement guard', async () => {
    const host = await import('../lib/index.js')
    expect(typeof host.apply).toBe('function')
    expect(typeof host.Config).toBe('function')
    expect(() => host.apply(new Context(), { remoteManagement: true } as never)).toThrow(
      'remoteManagement is unsupported by the Alpha.4 Host RPC',
    )
  })

  it('exports the invariant runtime from its published subpath', async () => {
    const invariant = await import('../lib/invariant.js')
    expect(typeof invariant.assertOpenCodeGoInvariant).toBe('function')
    expect(() => invariant.assertOpenCodeGoInvariant(true, 'built-artifact')).not.toThrow()
  })
})
