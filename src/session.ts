/** OpenCode Go requires x-opencode-session on every zen/go/v1 request (all models). */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export const OPENCODE_GO_SESSION_HEADER = 'x-opencode-session'
const FALLBACK_SESSION = 'ses_dsh-opencode-go-' + randomUUID()
const store = new AsyncLocalStorage<string>()

export function openCodeGoSessionId(): string {
  return store.getStore() ?? FALLBACK_SESSION
}

export function openCodeGoSessionHeaders(sessionId = openCodeGoSessionId()): Record<string, string> {
  return { [OPENCODE_GO_SESSION_HEADER]: sessionId }
}

/** Bind session id for the duration of work so profile header getters see it. */
export function runOpenCodeGoSession<T>(sessionId: string | undefined, work: () => T): T {
  const id = sessionId !== undefined && sessionId.length > 0 ? sessionId : FALLBACK_SESSION
  return store.run(id, work)
}

/** Live header bag: PiAiAdapter copies this at stream start, so the getter must read ALS then. */
export function openCodeGoProfileHeaders(): Record<string, string> {
  return Object.defineProperty({}, OPENCODE_GO_SESSION_HEADER, {
    enumerable: true,
    configurable: true,
    get: openCodeGoSessionId,
  }) as Record<string, string>
}
