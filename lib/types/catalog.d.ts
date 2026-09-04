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
 */
export declare function protocolForModel(id: string): OpenCodeGoApi;
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