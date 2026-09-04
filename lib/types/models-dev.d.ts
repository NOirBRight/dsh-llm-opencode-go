/** Live models.dev overlay for OpenCode Go ids that GET /models does not describe. */
import type { OpenCodeGoCatalogModelConfig } from './client-contract.ts';
/** Public models.dev catalog used to fill OpenCode Go capacities. */
export declare const MODELS_DEV_URL = "https://models.dev/api.json";
export declare const MODELS_DEV_MAX_BYTES: number;
export declare const MODELS_DEV_TIMEOUT_MS = 15000;
/** How long Fetch will wait for models.dev before showing the local snapshot. */
export declare const MODELS_DEV_WAIT_MS = 800;
export type OpenCodeGoModelsDevOverlay = ReadonlyMap<string, OpenCodeGoCatalogModelConfig>;
/** Tests point the disk cache at a temp file; production uses tmpdir. */
export declare function setOpenCodeGoModelsDevCachePathForTests(path: string | undefined): void;
/** Drop the process-local models.dev cache. Tests use this. */
export declare function clearOpenCodeGoModelsDevCache(): void;
/** Return the cached overlay without fetching. */
export declare function peekOpenCodeGoModelsDev(): OpenCodeGoModelsDevOverlay | undefined;
/** Parse one models.dev OpenCode Go row into catalog fields. */
export declare function parseOpenCodeGoModelsDevRow(id: string, value: unknown): OpenCodeGoCatalogModelConfig | undefined;
/** Parse the opencode-go.models object out of a models.dev API document. */
export declare function parseOpenCodeGoModelsDev(value: unknown): OpenCodeGoModelsDevOverlay;
/** Fetch models.dev, returning an empty overlay when the document is unavailable. */
export declare function loadOpenCodeGoModelsDev(fetchImpl?: typeof fetch, signal?: AbortSignal): Promise<OpenCodeGoModelsDevOverlay>;
//# sourceMappingURL=models-dev.d.ts.map