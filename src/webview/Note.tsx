import { useEffect, useRef, useState } from "react";

/**
 * The reader's comment on a step: a question or a change request for the
 * agent. Saved when you leave the box (or press Cmd/Ctrl+Enter); Escape
 * puts back what was there.
 */
export function Note({
    comment,
    focus,
    onSave,
    onDone,
}: {
    comment: string;
    /** Focus the box (it was just opened). */
    focus: boolean;
    onSave: (comment: string) => void;
    onDone: () => void;
}) {
    const [draft, setDraft] = useState(comment);
    const box = useRef<HTMLTextAreaElement>(null);
    useEffect(() => setDraft(comment), [comment]);
    useEffect(() => {
        if (focus) {
            box.current?.focus();
        }
    }, [focus]);
    // Grow with the text, so nothing scrolls inside the box.
    useEffect(() => {
        const element = box.current;
        if (element) {
            element.style.height = "auto";
            element.style.height = `${element.scrollHeight}px`;
        }
    }, [draft]);

    return (
        <textarea
            ref={box}
            className="note"
            rows={1}
            value={draft}
            placeholder="Ask a question, or request a change…"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft.trim() !== comment) {
                    onSave(draft);
                }
                onDone();
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    setDraft(comment);
                    requestAnimationFrame(() => box.current?.blur());
                } else if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                ) {
                    box.current?.blur();
                }
            }}
        />
    );
}
