/** Documented OpenCode Go metadata used when GET /models has no capacities. */
import type { OpenCodeGoApi, OpenCodeGoCatalogModelConfig } from './client-contract.ts';
export type OpenCodeGoFamily = 'grok' | 'gpt' | 'glm' | 'kimi' | 'qwen' | 'deepseek' | 'minimax' | 'mimo' | 'hy3' | 'longcat' | 'muse' | 'other';
export interface OpenCodeGoKnownModel {
    id: string;
    name: string;
    contextWindow: number;
    maxTokens: number;
    api: OpenCodeGoApi;
    vision: boolean;
    thinking: boolean;
    defaultEffort?: string;
    family: OpenCodeGoFamily;
}
/** Return the documented catalog entry for an exact model id. */
export declare function knownModel(id: string): OpenCodeGoKnownModel | undefined;
/**
 * Infer the wire protocol from official docs, then prefix families for live-only ids.
 * Official mapping: grok/gpt/muse → Responses; MiniMax/Qwen → Messages; everything else → Completions.
 *
 * @see https://opencode.ai/docs/zh-cn/go/ API 端点 table
 */
export declare function protocolForModel(id: string): OpenCodeGoApi;
/**
 * Chat origin for one protocol. Completions and Responses use the configured
 * OpenAI-compatible origin (`https://opencode.ai/zen/go/v1`). Messages use the
 * Anthropic SDK origin: that same URL without one trailing `/v1`, because the
 * SDK posts `{base}/v1/messages` and the official table lists
 * `https://opencode.ai/zen/go/v1/messages`.
 *
 * @param baseURL Settings origin, usually ending in `/zen/go/v1`.
 * @param api Wire protocol for the selected model.
 * @returns Origin passed to pi-ai as `model.baseUrl`.
 * @see https://opencode.ai/docs/zh-cn/go/
 */
export declare function chatBaseURLForApi(baseURL: string, api: OpenCodeGoApi): string;
/** Family used only by the picker overlay. */
export declare function familyForModel(id: string): OpenCodeGoFamily;
export type OpenCodeGoListedModel = {
    name?: string;
    description?: string;
    contextWindow?: number;
    maxTokens?: number;
    vision?: boolean;
    thinking?: boolean;
    defaultEffort?: string;
    thinkingEfforts?: string[];
};
/** Merge live listing, models.dev, then the local snapshot. Do not invent a window. */
export declare function enrichModel(id: string, listed: OpenCodeGoListedModel, overlay?: OpenCodeGoListedModel): OpenCodeGoCatalogModelConfig;
//# sourceMappingURL=catalog.d.ts.map