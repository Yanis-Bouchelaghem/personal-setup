import { type ReactNode, useState } from "react";

import type { Answer } from "../core/answers";
import { CheckIcon, CommentIcon } from "./Icons";

/**
 * Everything said about a step, in order: your comment, the agent's answer,
 * your next comment, its answer. It ends with your reply being written (the
 * `reply` box) or a Reply button, so you can always carry on, even on a
 * folded step. Resolve folds the whole conversation to one line, "You asked:
 * …" with your last question; a click opens it again, and so does replying.
 */
export function Conversation({
    answers,
    resolved,
    reply,
    onReply,
    onResolve,
}: {
    /** The agent's answers on this step, oldest first. */
    answers: readonly Answer[];
    resolved: ReadonlySet<string>;
    /** Your reply being written, if any: it ends the conversation. */
    reply: ReactNode;
    onReply: () => void;
    /** Resolve the whole conversation, or open it again. */
    onResolve: (on: boolean) => void;
}) {
    const [peek, setPeek] = useState(false);
    const done = answers.every((answer) => resolved.has(answer.id));
    const last = answers.at(-1);
    if (done && !reply && !peek && last) {
        return (
            <button
                className="thread-folded"
                type="button"
                title="Show the conversation"
                onClick={() => setPeek(true)}
            >
                <CheckIcon />
                <span className="thread-folded-text">
                    You asked: {last.comment}
                </span>
                {answers.length > 1 && (
                    <span className="thread-count">
                        {answers.length} answers
                    </span>
                )}
            </button>
        );
    }
    return (
        <div className={done ? "thread resolved" : "thread"}>
            {answers.map((answer) => (
                <div className="thread-turn" key={answer.id}>
                    <p className="thread-q">
                        <span className="who">You</span>
                        {answer.comment}
                    </p>
                    <p className="thread-a">
                        <span className="who">Answer</span>
                        {answer.answer}
                    </p>
                </div>
            ))}
            {reply ? (
                <div className="thread-reply">
                    <span className="who">You</span>
                    {reply}
                </div>
            ) : (
                <div className="thread-actions">
                    <button
                        className="text-btn"
                        type="button"
                        title="Reply: ask a follow-up, or request a change · i"
                        onClick={onReply}
                    >
                        <CommentIcon />
                        Reply
                    </button>
                    <span className="thread-spacer" />
                    {done ? (
                        <>
                            <button
                                className="text-btn"
                                type="button"
                                onClick={() => setPeek(false)}
                            >
                                Fold
                            </button>
                            <button
                                className="text-btn"
                                type="button"
                                onClick={() => onResolve(false)}
                            >
                                Reopen
                            </button>
                        </>
                    ) : (
                        <button
                            className="text-btn"
                            type="button"
                            title="Resolve: fold the conversation away · r"
                            onClick={() => onResolve(true)}
                        >
                            <CheckIcon />
                            Resolve
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
