import { createContext, useContext } from "react";

import { type Segment, splitTerms } from "../core/terms";

/** Each term's colour slot for the tab being shown. */
export const TermColours = createContext<ReadonlyMap<string, number>>(
    new Map(),
);

/** Text an agent wrote, its backticked terms in their colour. */
export function TermText({ text }: { text: string }) {
    return <Segments segments={splitTerms(text)} />;
}

/** Pieces of text, the terms coloured and bold. */
export function Segments({ segments }: { segments: Segment[] }) {
    const slots = useContext(TermColours);
    return segments.map((segment, index) => {
        const slot = segment.term ? slots.get(segment.term) : undefined;
        return slot === undefined ? (
            segment.text
        ) : (
            <span className={`term term-${slot}`} key={index}>
                {segment.text}
            </span>
        );
    });
}
