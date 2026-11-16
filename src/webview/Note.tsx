import { type KeyboardEvent, useEffect, useRef, useState } from "react";

/** How long typing pauses before the comment is saved. */
const SAVE_AFTER_MS = 300;
/** Two "j" this close together leave the box, like `jj` in the editor. */
const JJ_MS = 400;

/**
 * The reader's comment on a step: a question or a change request for the
 * agent. Saved as you type (after a short pause), so the feedback bar and
 * the copied text are always up to date. Escape, `jj` or Cmd+Enter keep
 * what you wrote and give the keyboard back to the card, like leaving
 * insert mode.
 */
export function Note({
    comment,
    focus,
    onSave,
    onDone,
    onLeave,
}: {
    comment: string;
    /** Focus the box (it was just opened). */
    focus: boolean;
    onSave: (comment: string) => void;
    onDone: () => void;
    /** Leave the box from the keyboard: the card takes the focus back. */
    onLeave: () => void;
}) {
    const [draft, setDraft] = useState(comment);
    // The latest text, for saves that run before React re-renders.
    const text = useRef(comment);
    const box = useRef<HTMLTextAreaElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastJ = useRef(0);
    // What was last sent, so leaving and blurring don't save twice.
    const saved = useRef(comment.trim());

    const write = (next: string) => {
        text.current = next;
        setDraft(next);
    };

    // Follow changes from outside (a reset), but never while you are typing:
    // the saved value lags behind what you just typed.
    useEffect(() => {
        saved.current = comment.trim();
        if (document.activeElement !== box.current) {
            write(comment);
        }
    }, [comment]);
    useEffect(() => {
        const element = box.current;
        if (focus && element) {
            element.focus();
            // Carry on at the end, like `A`.
            element.setSelectionRange(
                element.value.length,
                element.value.length,
            );
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

    const save = () => {
        clearTimeout(timer.current);
        if (text.current.trim() !== saved.current) {
            saved.current = text.current.trim();
            onSave(text.current);
        }
    };

    /** The second "j" of `jj`: drop the first one, which is already typed. */
    const endsJJ = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "j" || event.ctrlKey || event.metaKey) {
            lastJ.current = 0;
            return false;
        }
        const element = event.currentTarget;
        const at = element.selectionStart;
        const quick = event.timeStamp - lastJ.current < JJ_MS;
        lastJ.current = event.timeStamp;
        if (
            !quick ||
            at !== element.selectionEnd ||
            element.value[at - 1] !== "j"
        ) {
            return false;
        }
        write(element.value.slice(0, at - 1) + element.value.slice(at));
        return true;
    };

    return (
        <textarea
            ref={box}
            className="note"
            rows={1}
            value={draft}
            placeholder="Ask a question, or request a change…"
            onChange={(event) => {
                write(event.target.value);
                clearTimeout(timer.current);
                timer.current = setTimeout(save, SAVE_AFTER_MS);
            }}
            onBlur={() => {
                save();
                onDone();
            }}
            onKeyDown={(event) => {
                const enter =
                    event.key === "Enter" && (event.metaKey || event.ctrlKey);
                if (event.key === "Escape" || enter || endsJJ(event)) {
                    event.preventDefault();
                    save();
                    onLeave();
                }
            }}
        />
    );
}
