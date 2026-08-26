/** Small invariant helper exported for built-entry verification. */

export function assertOpenCodeGoInvariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('dsh-llm-opencode-go invariant failed: ' + message)
}
