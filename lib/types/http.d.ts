/** Byte-limited response-body reading and Host JSON/key helpers. */
export { isJsonRecord } from './json-record.ts';
/** Normalize a stored Host credential; never used for browser-supplied secrets. */
export declare function requireUsableApiKey(raw: string, blankMessage: string): string;
/** Read a response as UTF-8 without buffering more than maxBytes. */
export declare function readBoundedText(response: Response, maxBytes: number, label: string, code: string, signal?: AbortSignal): Promise<string>;
//# sourceMappingURL=http.d.ts.map