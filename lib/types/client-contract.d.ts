/** Browser-safe constants and JSON decoders shared by the Host and client plugin faces. */
/** Settings namespace owned by the OpenCode Go plugin. */
export declare const OPENCODE_GO_SETTINGS_NAMESPACE = "llm-opencode-go";
/** Provider route owned by the OpenCode Go plugin. */
export declare const OPENCODE_GO_PROVIDER = "opencode-go";
/** Credential reference used when the settings section names none. */
export declare const DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
/** Public OpenCode Go API base URL. */
export declare const OPENCODE_GO_PUBLIC_BASE_URL = "https://opencode.ai/zen/go/v1";
/** Default context capacity for models without documented or discovered metadata. */
export declare const OPENCODE_GO_DEFAULT_CONTEXT_WINDOW = 262144;
/** Default maximum idle interval while a stream read is outstanding. */
export declare const OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
/** Private Connection RPC channel used by this package's two runtime faces. */
export declare const OPENCODE_GO_RPC_CHANNEL = "/opencode-go";
/** Provider-management settings snapshot endpoint. */
export declare const OPENCODE_GO_SETTINGS_READ_ENDPOINT = "settings/read";
/** Rich model-discovery endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
export declare const OPENCODE_GO_DISCOVER_ENDPOINT = "models/discover";
/** Revision-fenced settings-save endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
export declare const OPENCODE_GO_SAVE_ENDPOINT = "settings/save";
/** Value-free credential status endpoint. */
export declare const OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT = "credentials/status";
/** One-way credential write endpoint. */
export declare const OPENCODE_GO_CREDENTIAL_SET_ENDPOINT = "credentials/set";
/** Subscription usage-snapshot endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
export declare const OPENCODE_GO_USAGE_ENDPOINT = "usage/read";
/** Wire protocol selected for one OpenCode Go model. */
export type OpenCodeGoApi = 'openai-completions' | 'openai-responses' | 'anthropic-messages';
/** One model stored in the plugin's advisory catalog. */
export interface OpenCodeGoCatalogModelConfig {
    /** Wire model id accepted by the configured endpoint. */
    id: string;
    /** Selector label; omission uses {@link id}. */
    name?: string;
    /** Optional selector detail for similar model variants. */
    description?: string;
    /** Known combined request and response context capacity. */
    contextWindow?: number;
    /** Per-request output cap for this model. */
    maxTokens?: number;
    /** Whether the model accepts image input. */
    vision?: boolean;
    /** Whether the model supports native thinking. */
    thinking?: boolean;
    /** Chat-picker default when the conversation has not chosen a level. */
    defaultEffort?: string;
    /** Optional explicit protocol override; omission uses the documented mapping. */
    api?: OpenCodeGoApi;
    /** Legacy capability flag. Ignored at runtime; still decoded. */
    tools?: boolean;
}
/** Settings fields presented by the package's Web configuration card. */
export interface OpenCodeGoSettingsView {
    /** Credential reference resolved by the Host. */
    apiKeyEnv: string;
    /** Go API base URL ending in /zen/go/v1. */
    baseURL: string;
    /** Advisory model catalog. */
    models: OpenCodeGoCatalogModelConfig[];
    /** Optional provider-wide output cap. */
    maxTokens?: number;
    /** Context fallback for models without an exact capacity. */
    defaultContextWindow: number;
    /** Stream idle timeout in milliseconds. */
    streamIdleTimeoutMs: number;
}
/** Draft endpoint sent to Host discovery/usage. Secrets stay in the credentials API. */
export interface OpenCodeGoDiscoveryRequest {
    /** Unsaved API base URL. */
    baseURL?: string;
}
/** Rich model-discovery result returned to the package's own client card. */
export interface OpenCodeGoDiscoveryResult {
    /** Models in provider order, including documented protocol and capability flags. */
    models: OpenCodeGoCatalogModelConfig[];
}
/** Atomic editable-settings payload sent by the package's browser face. */
export interface OpenCodeGoSaveRequest {
    /** API URL currently shown by the editor. */
    baseURL: string;
    /** Complete advisory catalog currently shown by the editor. */
    models: OpenCodeGoCatalogModelConfig[];
    /** Settings descriptor revision from which the editor began. */
    expectedRevision: number;
}
/** Accepted settings snapshot returned after one atomic Host mutation. */
export interface OpenCodeGoSaveResult {
    /** Resolved settings after the mutation commits. */
    settings: OpenCodeGoSettingsView;
    /** New descriptor revision accepted by the Host. */
    revision: number;
}
/** Secret-free provider settings and credential snapshot. */
export interface OpenCodeGoSettingsReadResult extends OpenCodeGoSaveResult {
    credential: {
        configured: boolean;
        writable: boolean;
    };
}
export interface OpenCodeGoCredentialSetRequest {
    apiKey: string;
}
/** One model's accounted requests inside a usage window. */
export interface OpenCodeGoUsageModelCount {
    /** Provider-side model label. */
    name: string;
    /** Requests accounted to this model in the window. */
    requestCount: number;
}
/** One metered quota window. */
export interface OpenCodeGoUsageWindow {
    /** Consumed fraction of the window; 0.12 renders as "12.0%". */
    usage: number;
    /** Per-model request counts in the window, when the endpoint reports any. */
    models: OpenCodeGoUsageModelCount[];
    /** ISO-8601 instant when this window resets, when the endpoint reports one. */
    resetsAt?: string;
}
/** Secret-free subscription usage snapshot read for the configuration card. */
export interface OpenCodeGoUsageView {
    /** ISO-8601 time the Host read the snapshot. */
    fetchedAt: string;
    /** Rolling 5-hour window, when the endpoint reports one. */
    session?: OpenCodeGoUsageWindow;
    /** Weekly window, when the endpoint reports one. */
    weekly?: OpenCodeGoUsageWindow;
    /** Monthly window, when the endpoint reports one. */
    monthly?: OpenCodeGoUsageWindow;
}
/** Usage answer crossing the plugin RPC. */
export type OpenCodeGoUsageReply = {
    status: 'ok';
    usage: OpenCodeGoUsageView;
} | {
    status: 'unsupported';
};
/** Narrow one model crossing the settings or plugin-RPC JSON boundary. */
export declare function decodeOpenCodeGoCatalogModel(value: unknown): OpenCodeGoCatalogModelConfig | undefined;
/** Narrow the redacted, schema-resolved settings section before it enters React state. */
export declare function decodeOpenCodeGoSettings(value: unknown): OpenCodeGoSettingsView | undefined;
/** Narrow the rich discovery request received by the Host plugin. */
export declare function decodeOpenCodeGoDiscoveryRequest(value: unknown): OpenCodeGoDiscoveryRequest | undefined;
/** Narrow the Host discovery reply before the picker renders it. */
export declare function decodeOpenCodeGoDiscoveryResult(value: unknown): OpenCodeGoDiscoveryResult | undefined;
/** Narrow the atomic save request. */
export declare function decodeOpenCodeGoSaveRequest(value: unknown): OpenCodeGoSaveRequest | undefined;
/** Decode provider settings/credential management snapshot. */
export declare function decodeOpenCodeGoSettingsReadResult(value: unknown): OpenCodeGoSettingsReadResult | undefined;
export declare function decodeOpenCodeGoCredentialSetRequest(value: unknown): OpenCodeGoCredentialSetRequest | undefined;
/** Narrow the Host save reply. */
export declare function decodeOpenCodeGoSaveResult(value: unknown): OpenCodeGoSaveResult | undefined;
/** Decode the secret-free usage snapshot returned by the Host. */
export declare function decodeOpenCodeGoUsageView(value: unknown): OpenCodeGoUsageView | undefined;
/** Decode the usage RPC success payload. */
export declare function decodeOpenCodeGoUsageReply(value: unknown): OpenCodeGoUsageReply | undefined;
//# sourceMappingURL=client-contract.d.ts.map