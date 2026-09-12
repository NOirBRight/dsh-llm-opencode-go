/** Approved A provider header: identity, LLM badge, headline quota, status, chevron. */
import type { ReactNode } from 'react';
export interface ProviderHeadlineQuota {
    remainingPercent?: number;
    remainingFraction?: number;
    label?: string;
    detail?: string;
    emptyLabel?: string;
}
export declare function ProviderQuotaMeter(props: ProviderHeadlineQuota): ReactNode;
export declare const PROVIDER_UI_CSS: string;
export declare function ensureProviderUiCss(): void;
export declare function ProviderCardHeader(props: {
    title: string;
    mark: ReactNode;
    summary: string;
    open: boolean;
    unsaved?: boolean;
    unsavedLabel?: string;
    status?: string;
    role?: 'llm' | 'agent';
    quota?: ProviderHeadlineQuota;
}): ReactNode;
//# sourceMappingURL=approved-a-header.d.ts.map