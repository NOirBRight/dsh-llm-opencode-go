/**
 * Register the opencode-go route with chat delegated to pi-ai. Completions,
 * Responses, and Messages are selected per model. Discovery and usage stay
 * native Host RPCs; keys never cross the browser.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm';
import type { OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts';
export { DEFAULT_CONTEXT_WINDOW, DEFAULT_STREAM_IDLE_TIMEOUT_MS, OpenCodeGoAdapter, } from './adapter.ts';
export type { OpenCodeGoAdapterOptions, OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts';
export { PUBLIC_BASE_URL, discoverModels, parseOpenCodeGoModels } from './discovery.ts';
export { protocolForModel, enrichModel, familyForModel, knownModel } from './catalog.ts';
export { DEFAULT_USAGE_REQUEST_TIMEOUT_MS, OPENCODE_GO_USAGE_FAILED, OPENCODE_GO_USAGE_UNSUPPORTED, parseOpenCodeGoUsage, readOpenCodeGoUsage, } from './usage.ts';
export type { OpenCodeGoUsageRequest } from './usage.ts';
export { OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, OPENCODE_GO_DISCOVER_ENDPOINT, OPENCODE_GO_PROVIDER, OPENCODE_GO_PUBLIC_BASE_URL, OPENCODE_GO_RPC_CHANNEL, OPENCODE_GO_SAVE_ENDPOINT, OPENCODE_GO_SETTINGS_READ_ENDPOINT, OPENCODE_GO_SETTINGS_NAMESPACE, OPENCODE_GO_USAGE_ENDPOINT, decodeOpenCodeGoCatalogModel, decodeOpenCodeGoCredentialSetRequest, decodeOpenCodeGoDiscoveryRequest, decodeOpenCodeGoDiscoveryResult, decodeOpenCodeGoSettingsReadResult, decodeOpenCodeGoSaveRequest, decodeOpenCodeGoSaveResult, decodeOpenCodeGoSettings, decodeOpenCodeGoUsageReply, } from './client-contract.ts';
export type { OpenCodeGoApi, OpenCodeGoCatalogModelConfig, OpenCodeGoDiscoveryRequest, OpenCodeGoDiscoveryResult, OpenCodeGoSaveRequest, OpenCodeGoSaveResult, OpenCodeGoSettingsView, OpenCodeGoUsageModelCount, OpenCodeGoUsageReply, OpenCodeGoUsageView, OpenCodeGoUsageWindow, } from './client-contract.ts';
export { createOpenCodeGoPiAiProfile } from './pi-ai-profile.ts';
export type * from './types.ts';
export declare const name = "llm-opencode-go";
export declare const inject: string[];
export interface Config {
    baseURL?: string;
    models?: OpenCodeGoCatalogModel[];
    maxTokens?: number;
    defaultContextWindow?: number;
    streamIdleTimeoutMs?: number;
    retryPolicy?: RetryPolicyConfig;
    remoteManagement?: boolean;
}
export declare const Config: z<Config>;
export type ResolvedOpenCodeGoOptions = OpenCodeGoConnectionOptions;
export declare function resolveAdapterOptions(config: Config): OpenCodeGoConnectionOptions;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map