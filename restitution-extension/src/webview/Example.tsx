import { useState } from "react";

import type { StepExample } from "../core/restitution";
import { Collapse } from "./Collapse";
import { ChevronIcon } from "./Icons";

/**
 * Concrete data from outside the codebase (an API payload, CLI output),
 * folded to its title until the reader opens it. The card holds whether it
 * is open, so `e` can open all of a card's examples at once.
 */
export function Example({
    example,
    open,
    onToggle,
}: {
    example: StepExample;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <div className={open ? "example open" : "example"}>
            <button
                className="example-head"
                type="button"
                aria-expanded={open}
                title="Open or close · e"
                onClick={onToggle}
            >
                <span className="chev" aria-hidden="true">
                    <ChevronIcon />
                </span>
                <span className="example-title">{example.title}</span>
            </button>
            <Collapse open={open}>
                <pre className="example-body">{example.body}</pre>
            </Collapse>
        </div>
    );
}

/** Which of a card's examples are open: one by one, or all at once (`e`). */
export function useExamples(count: number) {
    const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
    return {
        isOpen: (index: number) => open.has(index),
        toggle: (index: number) => {
            const next = new Set(open);
            if (!next.delete(index)) {
                next.add(index);
            }
            setOpen(next);
        },
        /** Open them all, or close them all when they already are; true when opened. */
        toggleAll: () => {
            const opening = open.size < count;
            setOpen(
                new Set(
                    opening ? Array.from({ length: count }, (_, i) => i) : [],
                ),
            );
            return opening;
        },
    };
}
