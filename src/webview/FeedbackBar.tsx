import { useEffect, useState } from "react";

import type { ReviewRequest } from "../core/review";
import { SwapLabel } from "./SwapLabel";

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Pinned to the bottom while anything is asked: what you are about to send,
 * a button to copy it for your agent, and one to start over.
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

    if (requests.length === 0) {
        return null;
    }
    const clarify = requests.filter((request) => request.clarify).length;
    const comments = requests.filter((request) => request.comment).length;
    const summary = [
        ...(clarify ? [plural(clarify, "step") + " to clarify"] : []),
        ...(comments ? [plural(comments, "comment")] : []),
    ].join(" · ");

    return (
        <>
            <div className="feedback-spacer" aria-hidden="true" />
            <div
                className="feedback-bar glass"
                role="region"
                aria-label="Review"
            >
                <span className="feedback-summary">{summary}</span>
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
