/**
 * Translate OpenCode Go connection facts into a mixed-API pi-ai profile.
 * One route, three wire protocols: model.api selects Completions, Responses, or Messages.
 */
import type { Api } from '@earendil-works/pi-ai';
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai';
import type { OpenCodeGoConnectionOptions } from './adapter.ts';
export declare const OPENCODE_GO_DEFAULT_MODEL_MAX_TOKENS = 32768;
/** Resolve the complete pi-ai profile for one OpenCode Go options snapshot. */
export declare function createOpenCodeGoPiAiProfile(connection: OpenCodeGoConnectionOptions): ResolvedPiAiProviderProfile;
export type { Api };
//# sourceMappingURL=pi-ai-profile.d.ts.map