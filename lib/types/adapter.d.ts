/**
 * OpenCode Go chat adapter. The public route stays opencode-go, while the
 * wire implementation is delegated to pi-ai. Completions, Responses, and
 * Messages are selected per model. Discovery and usage stay native Host calls.
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, ResolvedRetryPolicy, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { CredentialRef } from '@deepseek-ai/dsh-credentials';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { discoverModels } from './discovery.ts';
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts';
import type { WireError } from './types.ts';
export type OpenCodeGoCatalogModel = OpenCodeGoCatalogModelConfig;
/** Validated connection facts for one operation. */
export interface OpenCodeGoConnectionOptions {
    /** Go API base, including /zen/go/v1. */
    baseURL: string;
    /** Credential reference of this same resolution, resolved per request. */
    apiKeyEnv: CredentialRef;
    /** Models exposed to discovery consumers and accepted for chat requests. */
    models: readonly OpenCodeGoCatalogModel[];
    /** Positive context capacity used when the selected model has no exact value. */
    defaultContextWindow: number;
    /** Default per-request output cap; explicit request values win. */
    maxTokens: number | undefined;
    /** Maximum provider idle time while one stream read is outstanding. */
    streamIdleTimeoutMs: number;
    /** Provider-owned model-request retry policy, already resolved. */
    retryPolicy: ResolvedRetryPolicy;
}
/** Constructor options for OpenCodeGoAdapter. */
export interface OpenCodeGoAdapterOptions {
    options: () => OpenCodeGoConnectionOptions;
    resolveApiKey: (connection: OpenCodeGoConnectionOptions) => Promise<string>;
    resolveAttachments?: () => AttachmentStore | undefined;
}
export declare const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
export declare const DEFAULT_CONTEXT_WINDOW = 262144;
/** Map an HTTP status to a stable LlmError code for source-compatible callers. */
export declare function httpErrorCode(status: number, error?: WireError): string;
/** Classify documented transient OpenCode Go failures that can arrive without an HTTP status. */
export declare function classifyOpenCodeGoTransientError(chunk: StreamChunk): StreamChunk;
/** The OpenCode Go chat adapter backed by a mixed-API pi-ai profile. */
export declare class OpenCodeGoAdapter extends LlmAdapter {
    private readonly config;
    private readonly auth;
    private snapshot;
    constructor(config: OpenCodeGoAdapterOptions);
    private current;
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{
        model: LlmResolvedModelInfo;
        stream: (options: GenerateOptions) => AsyncGenerator<StreamChunk, void, unknown>;
    }>;
}
export { discoverModels };
//# sourceMappingURL=adapter.d.ts.map