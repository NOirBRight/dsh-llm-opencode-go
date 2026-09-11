/** Browser half: OpenCode Go setup inside Plugin configuration. */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { OpenCodeGoSettingsKey } from './locales.ts';
import { createOpenCodeGoUsageReader } from './usage-reader.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'settings.provider.item': {
            kind: 'keyed';
            scope: 'root';
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        providerDirectory?: {
            register(declaration: {
                key: string;
                /** Display name for the overview and detail title. */
                name?: string;
                role?: 'llm' | 'agent';
                header?: 'shared' | 'legacy';
                /** Who renders the expanded detail: the shared template, or the legacy card. */
                detail?: 'shared' | 'legacy';
                usage?: ReturnType<typeof createOpenCodeGoUsageReader>;
                /** Active model count for the overview subline. */
                modelCount?: () => number | undefined;
            }): () => void;
            invalidateUsage(key: string): void;
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