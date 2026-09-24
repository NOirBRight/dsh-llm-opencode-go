/** Provider Directory quota reader so OpenCode Go usage is cached and shown in the task panel. */
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client';
import type { OpenCodeGoUsageView } from '../client-contract.ts';
export interface OpenCodeGoUsageWindowSummary {
    id: string;
    label: string;
    shortLabel: string;
    remainingPercent?: number;
    valueText: string;
    resetsAt?: string;
}
export interface OpenCodeGoUsageReader {
    providerKey: string;
    name: string;
    read(rpc: ClientConnectionRpc, refresh: boolean, signal: AbortSignal): Promise<{
        status: 'ready';
        fetchedAt: string;
        windows: readonly OpenCodeGoUsageWindowSummary[];
    } | {
        status: 'logged-out';
    } | {
        status: 'unsupported';
    } | {
        status: 'error';
        message?: string;
    }>;
}
export declare function remainingPercent(used: number): number;
export declare function clearOpenCodeGoUsageCacheForTests(): void;
export declare function peekOpenCodeGoUsageView(): OpenCodeGoUsageView | undefined;
/**
 * Persist a decoded usage view for this card's legacy first paint.
 * Writes only the plugin-private view cache, never the store-owned shared quota cache.
 * @param view - decoded Host usage snapshot.
 */
export declare function persistOpenCodeGoUsage(view: OpenCodeGoUsageView): void;
export declare function createOpenCodeGoUsageReader(): OpenCodeGoUsageReader;
//# sourceMappingURL=usage-reader.d.ts.map