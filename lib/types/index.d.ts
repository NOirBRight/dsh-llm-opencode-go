/**
 * Register the OpenCode Go route with chat delegated to pi-ai. Completions,
 * Responses, and Messages are selected per model. Discovery and usage use the
 * authenticated Host plugin Fetch route; keys never cross the browser.
 */
import type { Context, Volatile, VolatileSnapshot } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm';
import type { OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts';
export { DEFAULT_CONTEXT_WINDOW, DEFAULT_STREAM_IDLE_TIMEOUT_MS, OpenCodeGoAdapter, } from './adapter.ts';
export type { OpenCodeGoAdapterOptions, OpenCodeGoCatalogModel, OpenCodeGoConnectionOptions } from './adapter.ts';
export { PUBLIC_BASE_URL, discoverModels, parseOpenCodeGoModels } from './discovery.ts';
export { protocolForModel, chatBaseURLForApi, enrichModel, familyForModel, knownModel } from './catalog.ts';
export { DEFAULT_USAGE_REQUEST_TIMEOUT_MS, OPENCODE_GO_USAGE_FAILED, OPENCODE_GO_USAGE_UNSUPPORTED, parseOpenCodeGoUsage, readOpenCodeGoUsage, } from './usage.ts';
export type { OpenCodeGoUsageRequest } from './usage.ts';
export { DEFAULT_API_KEY_ENV, OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, OPENCODE_GO_DISCOVER_ENDPOINT, OPENCODE_GO_ENTRY_ID, OPENCODE_GO_PROVIDER, OPENCODE_GO_PUBLIC_BASE_URL, OPENCODE_GO_RPC_ENDPOINT, OPENCODE_GO_USAGE_ENDPOINT, OPENCODE_GO_VALIDATE_ENDPOINT, decodeOpenCodeGoCatalogModel, decodeOpenCodeGoCredentialSetRequest, decodeOpenCodeGoDiscoveryRequest, decodeOpenCodeGoDiscoveryResult, decodeOpenCodeGoValidationRequest, decodeOpenCodeGoUsageReply, } from './client-contract.ts';
export type { OpenCodeGoApi, OpenCodeGoCatalogModelConfig, OpenCodeGoDiscoveryRequest, OpenCodeGoDiscoveryResult, OpenCodeGoSaveResult, OpenCodeGoSettingsView, OpenCodeGoUsageModelCount, OpenCodeGoUsageReply, OpenCodeGoUsageView, OpenCodeGoUsageWindow, } from './client-contract.ts';
export { createOpenCodeGoPiAiProfile } from './pi-ai-profile.ts';
export type * from './types.ts';
export declare const name = "llm-opencode-go";
export declare const inject: string[];
export interface Config {
    apiKeyEnv: string;
    baseURL: Volatile<string>;
    models: Volatile<OpenCodeGoCatalogModel[]>;
    maxTokens?: number;
    defaultContextWindow: number;
    streamIdleTimeoutMs: number;
    retryPolicy?: RetryPolicyConfig;
}
interface ConfigValues {
    apiKeyEnv?: string;
    baseURL?: string;
    models?: VolatileSnapshot<OpenCodeGoCatalogModel[]>;
    maxTokens?: number;
    defaultContextWindow?: number;
    streamIdleTimeoutMs?: number;
    retryPolicy?: RetryPolicyConfig;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    apiKeyEnv: z<string, string, "defined">;
    baseURL: z<string, string, "volatile-defined">;
    models: z<NoInfer<import("./client-contract.ts").OpenCodeGoCatalogModelConfig[]>, NoInfer<import("./client-contract.ts").OpenCodeGoCatalogModelConfig[]>, "volatile-defined">;
    defaultContextWindow: z<number, number, "defined">;
    streamIdleTimeoutMs: z<number, number, "defined">;
    retryPolicy: z<RetryPolicyConfig>;
}>>, Schemastery.ObjectT<NoInfer<{
    apiKeyEnv: z<string, string, "defined">;
    baseURL: z<string, string, "volatile-defined">;
    models: z<NoInfer<import("./client-contract.ts").OpenCodeGoCatalogModelConfig[]>, NoInfer<import("./client-contract.ts").OpenCodeGoCatalogModelConfig[]>, "volatile-defined">;
    defaultContextWindow: z<number, number, "defined">;
    streamIdleTimeoutMs: z<number, number, "defined">;
    retryPolicy: z<RetryPolicyConfig>;
}>>, "plain">;
export type ResolvedOpenCodeGoOptions = OpenCodeGoConnectionOptions;
export declare function resolveAdapterOptions(config: ConfigValues): OpenCodeGoConnectionOptions;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map