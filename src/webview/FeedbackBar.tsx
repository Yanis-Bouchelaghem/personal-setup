import { useEffect, useRef, useState } from "react";

import type { ReviewRequest } from "../core/review";
import { SwapLabel } from "./SwapLabel";

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Pinned to the bottom while anything is asked: what you are about to send,
 * a button to copy it for your agent, and one to start over. It slides up
 * when the first thing is asked, with a short glow, and back down when
 * nothing is left.
 */
export function FeedbackBar({
    requests,
    onCopy,
    onReset,
}: {
    requests: ReviewRequest[];
    onCopy: () => void;
    onReset: () => void;
}) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) {
            return undefined;
        }
        const timer = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(timer);
    }, [copied]);

    const shown = requests.length > 0;
    const glow = useGlowOnAppear(shown);

    // While the bar slides away it keeps saying what it said.
    const clarify = requests.filter((request) => request.clarify).length;
    const comments = requests.filter((request) => request.comment).length;
    const summary = [
        ...(clarify ? [plural(clarify, "step") + " to clarify"] : []),
        ...(comments ? [plural(comments, "comment")] : []),
    ].join(" · ");
    const lastSummary = useRef(summary);
    if (summary) {
        lastSummary.current = summary;
    }

    const classes = [
        "feedback-bar",
        "glass",
        shown ? "shown" : "",
        glow.on ? "glow" : "",
    ];
    return (
        <>
            <div
                className={shown ? "feedback-spacer shown" : "feedback-spacer"}
                aria-hidden="true"
            />
            <div
                className={classes.filter(Boolean).join(" ")}
                role="region"
                aria-label="Review"
                aria-hidden={!shown}
                inert={!shown}
                onAnimationEnd={glow.end}
            >
                <span className="feedback-summary">{lastSummary.current}</span>
                <button className="text-btn" type="button" onClick={onReset}>
                    Reset
                </button>
                <button
                    className={`primary-btn${copied ? " copied" : ""}`}
                    type="button"
                    onClick={() => {
                        onCopy();
                        setCopied(true);
                    }}
                >
                    <SwapLabel
                        texts={["Copy for agent", "Copied!"]}
                        current={copied ? "Copied!" : "Copy for agent"}
                    />
                </button>
            </div>
        </>
    );
}

/**
 * A glow when the bar comes up, fading away: only when it appears, not when
 * a tab that already has requests is opened.
 */
function useGlowOnAppear(shown: boolean) {
    const [on, setOn] = useState(false);
    const before = useRef(shown);
    useEffect(() => {
        if (shown && !before.current) {
            setOn(true);
        }
        before.current = shown;
    }, [shown]);
    return { on, end: () => setOn(false) };
}
