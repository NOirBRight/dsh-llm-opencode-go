import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Keep in lockstep with `CLIENT_EXTERNALS` in tsdown.config.ts. */
const CLIENT_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
  '@deepseek-ai/dsh-client-ui-slots',
])

describe('client bundle module table', () => {
  it('only requires specifiers the web module table can answer', () => {
    const code = readFileSync(resolve('lib/client.js'), 'utf8')
    const required = [...code.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1]!)
    expect(required.length).toBeGreaterThan(0)
    expect(required.filter(spec => !CLIENT_EXTERNALS.has(spec))).toEqual([])
  })
})
