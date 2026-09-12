export declare const OPENCODE_GO_SESSION_HEADER = "x-opencode-session";
export declare function openCodeGoSessionId(): string;
export declare function openCodeGoSessionHeaders(sessionId?: string): Record<string, string>;
/** Bind session id for the duration of work so profile header getters see it. */
export declare function runOpenCodeGoSession<T>(sessionId: string | undefined, work: () => T): T;
/** Live header bag: PiAiAdapter copies this at stream start, so the getter must read ALS then. */
export declare function openCodeGoProfileHeaders(): Record<string, string>;
//# sourceMappingURL=session.d.ts.map