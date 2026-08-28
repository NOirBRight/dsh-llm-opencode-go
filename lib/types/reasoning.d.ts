/** Per-family OpenCode Go thinking levels and plugin-owned defaults. */
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type { ModelThinkingLevel, ThinkingLevelMap } from '@earendil-works/pi-ai';
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts';
/** Canonical ordering used by pi-ai and the settings UI. */
export declare const OPENCODE_GO_EFFORT_ORDER: readonly ModelThinkingLevel[];
/** Supported thinking levels for one catalog row, in canonical order. */
export declare function openCodeGoSupportedEfforts(model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking'>): readonly ModelThinkingLevel[];
/** Thinking-level map for one catalog row, or undefined when thinking is off. */
export declare function openCodeGoThinkingLevelMap(model: OpenCodeGoCatalogModelConfig): ThinkingLevelMap | undefined;
/** Plugin-owned default effort for a known family. */
export declare function openCodeGoDefaultEffort(model: string): ModelThinkingLevel | undefined;
/** Display name for one effort id (e.g. "high" -> "High", "xhigh" -> "Xhigh"). */
export declare function formatEffortName(level: ModelThinkingLevel): string;
/** Effective default for a draft row: explicit if valid, else family default, else first supported. */
export declare function resolveEffectiveDefaultEffort(model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking'> & {
    defaultEffort?: string;
}): ModelThinkingLevel | undefined;
/** Whether an explicit effort is valid for the model's family. */
export declare function isValidEffortForModel(model: Pick<OpenCodeGoCatalogModelConfig, 'id' | 'thinking'>, effort: string): boolean;
/** Attach the family or row default to a resolved model when that level is offered. */
export declare function applyOpenCodeGoReasoningMetadata(info: LlmResolvedModelInfo, model: string, override?: string): LlmResolvedModelInfo;
//# sourceMappingURL=reasoning.d.ts.map