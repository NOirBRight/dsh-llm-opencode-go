/** Per-family OpenCode Go thinking levels and plugin-owned defaults. */
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type { ModelThinkingLevel, ThinkingLevelMap } from '@earendil-works/pi-ai';
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts';
/** Thinking-level map for one catalog row, or undefined when thinking is off. */
export declare function openCodeGoThinkingLevelMap(model: OpenCodeGoCatalogModelConfig): ThinkingLevelMap | undefined;
/** Plugin-owned default effort for a known family. */
export declare function openCodeGoDefaultEffort(model: string): ModelThinkingLevel | undefined;
/** Attach the family or row default to a resolved model when that level is offered. */
export declare function applyOpenCodeGoReasoningMetadata(info: LlmResolvedModelInfo, model: string, override?: string): LlmResolvedModelInfo;
//# sourceMappingURL=reasoning.d.ts.map