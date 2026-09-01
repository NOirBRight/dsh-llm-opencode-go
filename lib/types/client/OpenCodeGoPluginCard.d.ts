/** OpenCode Go connection and model-catalog card for Plugin configuration. */
import type { ReactNode } from 'react';
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { OpenCodeGoCatalogModelConfig, OpenCodeGoDiscoveryRequest, OpenCodeGoSaveResult, OpenCodeGoSettingsView, OpenCodeGoUsageView } from '../client-contract.ts';
import type { OpenCodeGoSettingsKey } from './locales.ts';
/** Credential state exposed without returning the credential value. */
export interface OpenCodeGoCredentialState {
    /** Whether any Host credential layer supplies the reference. */
    configured: boolean;
    /** Whether the writable credentials provider can replace it. */
    writable: boolean;
}
/**
 * Answer of one usage read: the snapshot, an endpoint without a usage
 * surface, or a running Host whose plugin code predates the usage endpoint
 * (a restart loads it; the card says so instead of showing an error).
 */
export type OpenCodeGoUsageRead = {
    kind: 'ok';
    usage: OpenCodeGoUsageView;
} | {
    kind: 'unsupported';
} | {
    kind: 'needs-restart';
};
/** Dependencies injected by the browser-plugin registration. */
export interface OpenCodeGoPluginCardFace {
    /** Localized card copy. */
    t: (key: OpenCodeGoSettingsKey) => string;
    hooks: {
        /** Reactive Host-owned settings section. */
        openCodeGoSettings: SettingsScope<OpenCodeGoSettingsView>;
    };
    /** Read value-free credential status for the section's reference. */
    describeCredential: () => Promise<OpenCodeGoCredentialState>;
    /** Persist a typed key through the credentials API before Host reads. */
    storeApiKey: (apiKey: string) => Promise<void>;
    /** Atomically store changed settings and return the accepted Host snapshot. */
    saveConfiguration: (settings: OpenCodeGoSettingsView, apiKey?: string) => Promise<OpenCodeGoSaveResult>;
    /** Ask Host to list models using the stored credential. */
    discoverModels: (request: OpenCodeGoDiscoveryRequest) => Promise<readonly OpenCodeGoCatalogModelConfig[]>;
    /** Ask Host to read usage using the stored credential. */
    fetchUsage: (request: OpenCodeGoDiscoveryRequest) => Promise<OpenCodeGoUsageRead>;
    /** Open the frame-level picker immediately with the current selected ids. */
    beginModelPicker: (initiallyPicked: ReadonlySet<string>, onAdopt: (models: readonly OpenCodeGoCatalogModelConfig[]) => void) => void;
    /** Populate the open picker with discovered candidates. */
    completeModelPicker: (candidates: readonly OpenCodeGoCatalogModelConfig[]) => void;
    /** Show a discovery failure in the open picker. */
    failModelPicker: (message: string) => void;
    /** Close a picker whose owning settings card unmounts. */
    closeModelPicker: () => void;
}
/** Props delivered by the Plugin configuration item slot. */
export type OpenCodeGoPluginCardProps = PropsRuntime<'settings.provider.item'> & InjectFace<OpenCodeGoPluginCardFace>;
/** Render the single-package OpenCode Go contribution under Plugin configuration. */
export declare function OpenCodeGoPluginCard(props: OpenCodeGoPluginCardProps): ReactNode;
//# sourceMappingURL=OpenCodeGoPluginCard.d.ts.map