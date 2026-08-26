/**
 * Host-only OpenCode Go subscription usage. Official endpoint:
 * GET https://opencode.ai/zen/go/v1/usage
 * returns rolling / weekly / monthly percent windows. Never blocks chat.
 */
import type { OpenCodeGoUsageView } from './client-contract.ts';
export declare const DEFAULT_USAGE_REQUEST_TIMEOUT_MS = 15000;
export declare const OPENCODE_GO_USAGE_UNSUPPORTED = "OPENCODE_GO_USAGE_UNSUPPORTED";
export declare const OPENCODE_GO_USAGE_FAILED = "OPENCODE_GO_USAGE_FAILED";
export interface OpenCodeGoUsageRequest {
    baseURL?: string;
    signal?: AbortSignal;
}
/** Convert the official usage reply into the secret-free snapshot the card renders. */
export declare function parseOpenCodeGoUsage(value: unknown, url: string): OpenCodeGoUsageView;
/** Read rolling/weekly/monthly subscription windows without issuing a model request. */
export declare function readOpenCodeGoUsage(request: OpenCodeGoUsageRequest, storedApiKey?: () => Promise<string | undefined>, fetchImpl?: typeof fetch): Promise<OpenCodeGoUsageView>;
//# sourceMappingURL=usage.d.ts.map