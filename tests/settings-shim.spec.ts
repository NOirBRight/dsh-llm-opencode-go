import { describe, expect, it } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '../src/client/shim.ts'

describe('SettingsScope shim structural compatibility', () => {
  it('accepts rc-style scope without mutate', () => {
    const snap: SettingsScopeSnapshot<string> = { status: 'ready', value: 'x', base: undefined, user: undefined, revision: 1, writable: true, mode: 'host' }
    const scope: SettingsScope<string> = {
      getSnapshot: () => snap,
      subscribe: (listener) => { listener(); return () => {} },
      set: async () => {},
      unset: async () => {},
    }
    expect(scope.getSnapshot().value).toBe('x')
    expect(scope.mutate).toBeUndefined()
  })

  it('is assignable from alpha1 runtime scope with mutate', () => {
    const snap: SettingsScopeSnapshot<string> = { status: 'ready', value: 'y', base: undefined, user: undefined, revision: 2, writable: true, mode: 'host' }
    const alphaScope = {
      getSnapshot: () => snap,
      subscribe: (listener: () => void) => { listener(); return () => {} },
      set: async (_field: string, _value: unknown) => {},
      unset: async (_field: string) => {},
      mutate: async (_ops: readonly unknown[], _expectedRevision?: number) => {},
    }
    const shimScope: SettingsScope<string> = alphaScope
    expect(shimScope.getSnapshot().value).toBe('y')
    expect(typeof shimScope.mutate).toBe('function')
  })

  it('preserves snapshot shape across both hosts', () => {
    const snap: SettingsScopeSnapshot<{ a: number }> = { status: 'loading', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false, mode: 'memory' }
    expect(snap.status).toBe('loading')
    expect(snap.mode).toBe('memory')
  })
})
