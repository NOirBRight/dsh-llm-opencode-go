/** Browser half: OpenCode Go setup inside Plugin configuration. */
import type { ClientContext } from './shim.js';
import type { OpenCodeGoSettingsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'settings.provider.item': {
            kind: 'keyed';
            scope: 'root';
        };
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** OpenCode Go Plugin configuration copy. */
        'settings.opencode-go': OpenCodeGoSettingsKey;
    }
}
/** Stable browser-plugin name. */
export declare const name = "dsh-llm-opencode-go-client";
/** Client services required by the Plugin configuration contribution. */
export declare const inject: string[];
/** Register localized OpenCode Go configuration under Plugin configuration. */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map