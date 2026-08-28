/** Shared model catalog visual pattern for provider cards.
 *
 * Extracted from opencode-go so every provider reuses the same grid and
 * control sizes: modelDetail is a flex column with a top border, row is a
 * 2-col grid, capabilities wraps, inputs are 36h/32h, select is 32h with an
 * arrow, and each row's content is a 4-col grid.
 */
import type { CSSProperties, ReactNode } from 'react';
export declare const inputStyle: CSSProperties;
export declare const rowInputStyle: CSSProperties;
export declare const selectStyle: CSSProperties;
export declare const rowStyle: CSSProperties;
export declare const modelContentStyle: CSSProperties;
export declare const modelDetailStyle: CSSProperties;
export declare const capabilitiesStyle: CSSProperties;
/** Small interface that hides raw styles behind layout components. */
export declare function ModelDetail({ children }: {
    children: ReactNode;
}): ReactNode;
export declare function ModelDetailRow({ children }: {
    children: ReactNode;
}): ReactNode;
export declare function Capabilities({ children }: {
    children: ReactNode;
}): ReactNode;
export declare function ModelRow({ children }: {
    children: ReactNode;
}): ReactNode;
//# sourceMappingURL=model-catalog-ui.d.ts.map