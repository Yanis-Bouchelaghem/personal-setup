import { useEffect, useRef, useState } from "react";

/** How long typing pauses before the comment is saved. */
const SAVE_AFTER_MS = 300;

/**
 * The reader's comment on a step: a question or a change request for the
 * agent. Saved as you type (after a short pause), so the feedback bar and
 * the copied text are always up to date; Escape puts back what was there
 * when you started.
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
    // The comment as it was when the box got focus, for Escape.
    const original = useRef(comment);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Follow changes from outside (a reset), but never while you are typing:
    // the saved value lags behind what you just typed.
    useEffect(() => {
        if (document.activeElement !== box.current) {
            setDraft(comment);
        }
    }, [comment]);
    useEffect(() => {
        if (focus) {
            box.current?.focus();
        }
    }, [focus]);
    useEffect(() => () => clearTimeout(timer.current), []);
    // Grow with the text, so nothing scrolls inside the box.
    useEffect(() => {
        const element = box.current;
        if (element) {
            element.style.height = "auto";
            element.style.height = `${element.scrollHeight}px`;
        }
    }, [draft]);

    const save = (text: string) => {
        clearTimeout(timer.current);
        if (text.trim() !== comment) {
            onSave(text);
        }
    };

    return (
        <textarea
            ref={box}
            className="note"
            rows={1}
            value={draft}
            placeholder="Ask a question, or request a change…"
            onFocus={() => {
                original.current = comment;
            }}
            onChange={(event) => {
                const text = event.target.value;
                setDraft(text);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => save(text), SAVE_AFTER_MS);
            }}
            onBlur={() => {
                save(draft);
                onDone();
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    setDraft(original.current);
                    save(original.current);
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
