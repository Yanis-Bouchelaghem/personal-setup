import { useState } from "react";

import type { Answer } from "../core/answers";
import type { FileDiff } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import type { ReviewRequest } from "../core/review";
import { fileRuns, type SourceLines } from "../core/source";
import { plainText, termsOf } from "../core/terms";
import { Collapse } from "./Collapse";
import { Conversation } from "./Conversation";
import { DiffView } from "./DiffView";
import { DocLinks } from "./DocLinks";
import { Example, useExamples } from "./Example";
import {
    ChevronIcon,
    ClarifyIcon,
    CommentIcon,
    IconButton,
    WarningIcon,
} from "./Icons";
import { Note } from "./Note";
import { stepCode } from "./StepCode";
import { TermText } from "./Terms";
import { useKeyCommands } from "./useKeyboard";
import { useLabelsFit } from "./useLabelsFit";
import { useScrollAnchor } from "./useScrollAnchor";
import { useSeenOnHover } from "./useSeenOnHover";

/** `gx` opens the first doc link, `2gx` the second; one that isn't there, nothing. */
function openNthDoc(
    docs: readonly { url: string }[],
    count: number,
    open: (url: string) => void,
): void {
    const doc = docs[count - 1];
    if (doc) {
        open(doc.url);
    }
}

export function StepCard({
    step,
    label,
    diffs,
    sources,
    viewed,
    updated,
    stale,
    request,
    answers,
    resolved,
    onResolve,
    onViewedChange,
    onSeen,
    onOpenRequest,
    onOpenUrl,
    onRequestChange,
}: {
    step: Step;
    label: string;
    diffs: Record<string, FileDiff>;
    /** Unchanged code steps point at. */
    sources: Record<string, SourceLines>;
    viewed: boolean;
    /** New or changed since the reader last looked. */
    updated: boolean;
    /** Its code changed after it was explained: the words may be out of date. */
    stale: boolean;
    /** What the reader asks the agent about this step, if anything. */
    request: ReviewRequest | undefined;
    /** The agent's answers to comments on this step. */
    answers: readonly Answer[];
    /** Which answers the reader resolved (by id). */
    resolved: ReadonlySet<string>;
    onResolve: (answer: string, on: boolean) => void;
    onViewedChange: (viewed: boolean) => void;
    /** The reader has looked at this updated step: clear its mark. */
    onSeen: () => void;
    onOpenRequest: (request: OpenRequest) => void;
    /** Open a documentation link in the browser. */
    onOpenUrl: (url: string) => void;
    onRequestChange: (clarify: boolean, comment: string | undefined) => void;
}) {
    const runs = fileRuns(step, diffs, sources);
    const clarify = request?.clarify ?? false;
    const comment = request?.comment ?? "";
    const [writing, setWriting] = useState(false);
    const examples = step.examples ?? [];
    const shownExamples = useExamples(examples.length);
    const toggleExamples = () => {
        // They live in the card's body: a folded card opens to show them.
        if (shownExamples.toggleAll() && viewed) {
            toggleViewed();
        }
    };
    const docs = step.docs ?? [];

    // Viewed is the only state: a viewed step is folded to its header.
    const open = !viewed;
    const { box, head, remember, snap } = useScrollAnchor<
        HTMLElement,
        HTMLElement
    >(viewed);
    const toggleViewed = () => {
        remember();
        onViewedChange(!viewed);
    };

    const hover = useSeenOnHover(updated, onSeen);
    const labelled = useLabelsFit(head);

    const { blocks, openCode, openDiff } = stepCode(runs, onOpenRequest);
    const toggleClarify = () => onRequestChange(!clarify, comment || undefined);

    useKeyCommands(box, {
        enter: openCode,
        open: openCode,
        diff: openDiff,
        toggle: toggleViewed,
        fold: viewed ? undefined : toggleViewed,
        unfold: viewed ? toggleViewed : undefined,
        clarify: toggleClarify,
        comment: () => setWriting(true),
        // With no examples there is nothing to toggle: it does nothing.
        examples: toggleExamples,
        docs: (count) => openNthDoc(docs, count, onOpenUrl),
        resolve: () => resolveAll(true),
    });
    const resolveAll = (on: boolean) =>
        answers
            .filter((answer) => resolved.has(answer.id) !== on)
            .forEach((answer) => onResolve(answer.id, on));

    // Once the agent has answered, comments carry on in the conversation.
    const talking = answers.length > 0;
    const replying = writing || comment !== "";
    const note = replying ? (
        <Note
            comment={comment}
            focus={writing}
            onSave={(text) => onRequestChange(clarify, text)}
            onDone={() => setWriting(false)}
            onLeave={() => box.current?.focus({ preventScroll: true })}
        />
    ) : undefined;
    // An open conversation shows even on a folded step, like a comment; a
    // resolved one only when the step is open.
    const unresolved = answers.some((answer) => !resolved.has(answer.id));
    const showTalk = talking && (open || unresolved || replying);

    const classes = [
        "card",
        "glass",
        open ? "" : "collapsed viewed-card",
        updated ? "updated" : "",
    ];
    return (
        <article
            className={classes.filter(Boolean).join(" ")}
            data-step={label}
            data-nav="card"
            tabIndex={-1}
            ref={box}
            {...hover}
        >
            {/* The whole header toggles Viewed; its own controls keep their jobs. */}
            <header
                className={labelled ? "card-head labelled" : "card-head"}
                ref={head}
                onClick={(event) => {
                    const own =
                        event.target instanceof Element &&
                        event.target.closest("button, a");
                    if (!own) {
                        toggleViewed();
                    }
                }}
            >
                {/* The header's toggle, for the keyboard. */}
                <button
                    className="chev chev-btn"
                    type="button"
                    aria-expanded={open}
                    title={
                        viewed
                            ? "Viewed (click to unfold) · a"
                            : "Mark as viewed · a"
                    }
                    onClick={toggleViewed}
                >
                    <ChevronIcon />
                </button>
                <span className="step-no">{label}</span>
                {stale && (
                    <span
                        className="stale-mark"
                        title="This code changed after it was explained: the explanation may be out of date"
                        role="img"
                        aria-label="Code changed since explained"
                    >
                        <WarningIcon />
                    </span>
                )}
                {/* A folded step still says what it does. */}
                <span
                    className="head-why"
                    title={viewed ? plainText(step.why) : undefined}
                >
                    <TermText text={step.why} />
                </span>
                <span className="actions">
                    <IconButton
                        label={
                            clarify
                                ? "Marked for clarification (click to unmark) · m"
                                : "Clarify: ask the agent to explain this step in smaller steps · m"
                        }
                        pressed={clarify}
                        onClick={toggleClarify}
                        text="Clarify"
                    >
                        <ClarifyIcon />
                    </IconButton>
                </span>
            </header>
            <Collapse open={open} snap={snap}>
                <div className="card-body">
                    {stale && (
                        <p className="stale-note">
                            <WarningIcon />
                            <span>
                                This code changed after it was explained, so the
                                explanation may be out of date.
                            </span>
                        </p>
                    )}
                    <p className="why">
                        <TermText text={step.why} />
                    </p>
                    {step.docs && (
                        <DocLinks docs={step.docs} onOpen={onOpenUrl} />
                    )}
                    {examples.map((example, index) => (
                        <Example
                            key={index}
                            example={example}
                            open={shownExamples.isOpen(index)}
                            onToggle={() => shownExamples.toggle(index)}
                        />
                    ))}
                    {blocks.length > 0 && (
                        <DiffView blocks={blocks} terms={termsOf(step.why)} />
                    )}
                    {!talking && !replying && (
                        <button
                            className="icon-btn comment-btn"
                            type="button"
                            title="Ask a question, or request a change · i"
                            onClick={() => setWriting(true)}
                        >
                            <CommentIcon />
                            <span>Comment</span>
                        </button>
                    )}
                </div>
            </Collapse>
            {showTalk && (
                <div className="card-threads">
                    <Conversation
                        answers={answers.toSorted((a, b) => a.at - b.at)}
                        resolved={resolved}
                        reply={note}
                        onReply={() => setWriting(true)}
                        onResolve={resolveAll}
                    />
                </div>
            )}
            {/* A comment stays visible even on a folded step, without its code. */}
            {!talking && note && <div className="card-note">{note}</div>}
        </article>
    );
}
