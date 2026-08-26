/** Frame-level model selection overlay opened by the OpenCode Go settings card. */
import type { ReactNode } from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { OpenCodeGoCatalogModelConfig } from '../client-contract.ts';
import type { OpenCodeGoSettingsKey } from './locales.ts';
/** Immutable observable state consumed by the shell overlay. */
export interface OpenCodeGoModelPickerSnapshot {
    /** Whether the overlay is visible. */
    open: boolean;
    /** Whether model metadata is still loading. */
    loading: boolean;
    /** Candidates in provider order. */
    candidates: readonly OpenCodeGoCatalogModelConfig[];
    /** IDs selected for adoption. */
    picked: ReadonlySet<string>;
    /** Visible discovery failure, when loading did not complete. */
    error?: string;
}
type Listener = () => void;
type Adopt = (models: readonly OpenCodeGoCatalogModelConfig[]) => void;
/** Shared observable joining the settings card to its frame-level overlay. */
export declare class OpenCodeGoModelPickerController {
    private snapshot;
    private readonly listeners;
    private onAdopt;
    /** Read the stable snapshot identity until picker state changes. */
    getSnapshot: () => OpenCodeGoModelPickerSnapshot;
    /** Subscribe one renderer listener. */
    subscribe: (listener: Listener) => (() => void);
    /** Open immediately while discovery loads with the current selection captured. */
    begin(onAdopt: Adopt, initiallyPicked?: ReadonlySet<string>): void;
    /** Populate an open loading picker, retaining only current ids present in the result. */
    complete(candidates: readonly OpenCodeGoCatalogModelConfig[]): void;
    /** Keep the open picker visible with a discovery failure. */
    fail(message: string): void;
    /** Close without adopting any candidate. */
    close: () => void;
    /** Toggle one candidate by id. */
    toggle: (id: string) => void;
    /** Close and deliver the selected candidates to the card. */
    adopt: () => void;
    private publish;
}
/** Values contributed to the shell overlay entry. */
export interface OpenCodeGoModelPickerFace {
    /** Localized picker copy. */
    t: (key: OpenCodeGoSettingsKey) => string;
    hooks: {
        /** Reactive picker state. */
        openCodeGoModelPicker: OpenCodeGoModelPickerController;
    };
    /** Close without adoption. */
    closePicker: () => void;
    /** Toggle one model id. */
    togglePickerModel: (id: string) => void;
    /** Adopt the selected models. */
    adoptPickerModels: () => void;
}
/** Props delivered by the frame overlay slot. */
export type OpenCodeGoModelPickerProps = PropsRuntime<'shell.overlay'> & InjectFace<OpenCodeGoModelPickerFace>;
/** Render the OpenCode Go model candidate picker in the frame overlay layer. */
export declare function OpenCodeGoModelPicker(props: OpenCodeGoModelPickerProps): ReactNode;
export {};
//# sourceMappingURL=OpenCodeGoModelPicker.d.ts.map