import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

describe('published runtime artifacts', () => {
  it('rejects unsupported remote management in the built Host', async () => {
    // Import the built output to exercise the published artifact, not source transforms.
    const { apply } = await import('../lib/index.js')
    expect(() => apply(new Context(), { remoteManagement: true } as never)).toThrow()
  })
})
