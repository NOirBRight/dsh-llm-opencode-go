/**
 * Live OpenCode Go model listing. GET /models returns ids only; documented
 * capacities and protocol are merged from the local catalog without inventing
 * windows for unknown ids.
 */
import type { LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm';
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts';
export declare const PUBLIC_BASE_URL = "https://opencode.ai/zen/go/v1";
export declare const MAX_DISCOVERY_BYTES: number;
export declare const DISCOVERY_TIMEOUT_MS = 30000;
export type OpenCodeGoDiscoveredModel = OpenCodeGoCatalogModelConfig;
/** Parse the OpenAI-shaped listing and attach documented metadata. */
export declare function parseOpenCodeGoModels(value: unknown): OpenCodeGoDiscoveredModel[];
/** Fetch the current public model catalog. */
export declare function discoverModels(request: LlmModelDiscoveryRequest, storedApiKey?: () => Promise<string | undefined>, fetchImpl?: typeof fetch, signal?: AbortSignal): Promise<readonly OpenCodeGoDiscoveredModel[]>;
//# sourceMappingURL=discovery.d.ts.map