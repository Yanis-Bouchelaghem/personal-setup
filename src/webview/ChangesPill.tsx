import { useRef } from "react";

import { ChevronIcon } from "./Icons";

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

/**
 * What the agent changed since you last looked, in git's "modified" colour:
 * floating at the bottom for as long as anything is left unseen, and a click
 * (or `]c`) takes you to the next one. It slides away once you have seen
 * them all, saying what it said on the way out.
 */
export function ChangesPill({
    steps,
    answers,
    onNext,
}: {
    /** Steps the agent changed or added. */
    steps: number;
    /** New answers to your comments. */
    answers: number;
    onNext: () => void;
}) {
    const shown = steps + answers > 0;
    const text = [
        ...(steps > 0 ? [plural(steps, "step changed", "steps changed")] : []),
        ...(answers > 0 ? [plural(answers, "new answer", "new answers")] : []),
    ].join(" · ");
    const last = useRef(text);
    if (text) {
        last.current = text;
    }
    return (
        <button
            className={shown ? "changes-pill shown" : "changes-pill"}
            type="button"
            title="Go to the next change · ]c"
            aria-hidden={!shown}
            inert={!shown}
            onClick={onNext}
        >
            <span className="changes-text">{last.current}</span>
            <span className="changes-next">
                Next
                <ChevronIcon />
            </span>
        </button>
    );
}
