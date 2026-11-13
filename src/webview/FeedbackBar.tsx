import type { ReviewRequest } from "../core/review";

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
    if (requests.length === 0) {
        return null;
    }
    const clarify = requests.filter((request) => request.clarify).length;
    const comments = requests.filter((request) => request.comment).length;
    const sent = requests.every((request) => request.sentAt !== undefined);
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
                <span className="feedback-summary">
                    <span>{summary}</span>
                    {sent && (
                        <span className="feedback-sent">
                            Sent, waiting for the agent
                        </span>
                    )}
                </span>
                <button className="text-btn" type="button" onClick={onReset}>
                    Reset
                </button>
                <button className="primary-btn" type="button" onClick={onCopy}>
                    {sent ? "Copy again" : "Copy for agent"}
                </button>
            </div>
        </>
    );
}
