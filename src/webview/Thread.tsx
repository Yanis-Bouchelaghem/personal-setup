import { useState } from "react";

import type { Answer } from "../core/answers";
import { CheckIcon } from "./Icons";

/**
 * The reader's comment and the agent's answer to it, on the step it is
 * about. It stays open until the reader resolves it; then it folds to one
 * line ("You asked: …") that opens again on a click. The question is what
 * the reader recognises, so that is what the folded line keeps.
 */
export function Thread({
    answer,
    resolved,
    onResolve,
}: {
    answer: Answer;
    resolved: boolean;
    onResolve: (on: boolean) => void;
}) {
    const [peek, setPeek] = useState(false);
    if (resolved && !peek) {
        return (
            <button
                className="thread-folded"
                type="button"
                title={`${answer.comment}\n\n${answer.answer}`}
                onClick={() => setPeek(true)}
            >
                <CheckIcon />
                <span className="thread-folded-text">
                    You asked: {answer.comment}
                </span>
            </button>
        );
    }
    return (
        <div className={resolved ? "thread resolved" : "thread"}>
            <p className="thread-q">
                <span className="who">You</span>
                {answer.comment}
            </p>
            <p className="thread-a">
                <span className="who">Answer</span>
                {answer.answer}
            </p>
            <div className="thread-actions">
                {resolved ? (
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
                        className="text-btn resolve-btn"
                        type="button"
                        title="Resolve: fold it away · r"
                        onClick={() => onResolve(true)}
                    >
                        <CheckIcon />
                        Resolve
                    </button>
                )}
            </div>
        </div>
    );
}
