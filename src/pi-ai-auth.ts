/**
 * Provide the auth services for the OpenCode Go pi-ai adapter.
 *
 * OpenCode Go resolves its API key through the request-local adapter hook, so this
 * process-local store starts empty and is only populated if a future login
 * flow writes a credential. Provider ambient auth is intentionally unavailable.
 *
 * @module dsh-llm-opencode-go/pi-ai-auth
 */

import type { AuthContext, Credential, CredentialStore } from '@earendil-works/pi-ai'

/**
 * Create the in-memory auth services used by OpenCode Go's pi-ai adapter.
 *
 * @returns auth services with an empty credential store and no ambient sources.
 */
export function createOpenCodeGoPiAiAuth(): { credentials: CredentialStore, authContext: AuthContext } {
  const stored = new Map<string, Credential>()
  return {
    credentials: {
      read: providerId => Promise.resolve(stored.get(providerId)),
      list: () => Promise.resolve([...stored].map(([providerId, credential]) => ({
        providerId,
        type: credential.type,
      }))),
      async modify(providerId, mutate) {
        const next = await mutate(stored.get(providerId))
        if (next !== undefined) stored.set(providerId, next)
        return stored.get(providerId)
      },
      delete: providerId => {
        stored.delete(providerId)
        return Promise.resolve()
      },
    },
    authContext: {
      env: () => Promise.resolve(undefined),
      fileExists: () => Promise.resolve(false),
    },
  }
}
