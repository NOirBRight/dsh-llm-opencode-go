//#region lib/types/invariant.js
/** Small invariant helper exported for built-entry verification. */
function assertOpenCodeGoInvariant(condition, message) {
	if (!condition) throw new Error("dsh-llm-opencode-go invariant failed: " + message);
}
//#endregion
export { assertOpenCodeGoInvariant };
