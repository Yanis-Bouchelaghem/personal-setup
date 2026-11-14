import { useState } from "react";

import { changedRanges, type FileDiff, selectLines } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import type { ReviewRequest } from "../core/review";
import { DiffView } from "./DiffView";
import { Example } from "./Example";
import {
    ChevronIcon,
    ClarifyIcon,
    CommentIcon,
    DiffIcon,
    FileIcon,
    IconButton,
} from "./Icons";
import { Note } from "./Note";
import { useLabelsFit } from "./useLabelsFit";
import { useScrollAnchor } from "./useScrollAnchor";
import { useSeenOnHover } from "./useSeenOnHover";

/** Folder part fades and truncates first; the file name always stays visible. */
function FilePath({ path }: { path: string }) {
    const split = path.lastIndexOf("/") + 1;
    return (
        <code className="chip" title={path}>
            <span className="dir">{path.slice(0, split)}</span>
            <span className="name">{path.slice(split)}</span>
        </code>
    );
}

/** What a step shows and where the editor should land when it is opened. */
function useStepCode(step: Step, diffs: Record<string, FileDiff>) {
    const file = step.file;
    const diff = file ? diffs[file] : undefined;
    // Exactly the lines the step chose, nothing around them.
    const ranges = step.lines ?? [];
    const hunks = selectLines(diff, ranges);
    // The editor selects only what changed, not the context shown around it;
    // a step that only removes code has no new-side lines, so it selects its range.
    const changed = changedRanges(hunks);
    const selection = changed.length > 0 ? changed : ranges;
    const status = diff?.status;
    return {
        file,
        hunks,
        selection,
        // Why a button cannot be used here; undefined when it can.
        noDiff: whyNoDiff(hunks.length, status),
        noFile: whyNoFile(hunks.length, status),
    };
}

const NO_CHANGES = "No uncommitted changes in these lines";

/** A diff only makes sense when both sides exist. */
function whyNoDiff(hunks: number, status: FileDiff["status"] | undefined) {
    if (hunks === 0) {
        return NO_CHANGES;
    }
    if (status === "added") {
        return "No diff: this file is new, every line is added";
    }
    if (status === "deleted") {
        return "No diff: this file was deleted, every line is removed";
    }
    return undefined;
}

function whyNoFile(hunks: number, status: FileDiff["status"] | undefined) {
    if (hunks === 0) {
        return NO_CHANGES;
    }
    return status === "deleted" ? "This file was deleted" : undefined;
}

export function StepCard({
    step,
    label,
    diffs,
    viewed,
    updated,
    request,
    onViewedChange,
    onSeen,
    onOpenRequest,
    onRequestChange,
}: {
    step: Step;
    label: string;
    diffs: Record<string, FileDiff>;
    viewed: boolean;
    /** New or changed since the reader last looked. */
    updated: boolean;
    /** What the reader asks the agent about this step, if anything. */
    request: ReviewRequest | undefined;
    onViewedChange: (viewed: boolean) => void;
    /** The reader has looked at this updated step: clear its mark. */
    onSeen: () => void;
    onOpenRequest: (request: OpenRequest) => void;
    onRequestChange: (clarify: boolean, comment: string | undefined) => void;
}) {
    const code = useStepCode(step, diffs);
    const { file } = code;
    const clarify = request?.clarify ?? false;
    const comment = request?.comment ?? "";
    const [writing, setWriting] = useState(false);

    // Viewed is the only state: a viewed step is folded to its header.
    const open = !viewed;
    const { box, head, remember } = useScrollAnchor<HTMLElement, HTMLElement>(
        viewed,
    );
    const toggleViewed = () => {
        remember();
        onViewedChange(!viewed);
    };

    const hover = useSeenOnHover(updated, onSeen);
    const labelled = useLabelsFit(head);

    // Where a click on the card takes you: the file with the changes
    // selected, or the diff when the file is gone.
    const openFile = () =>
        onOpenRequest({
            type: "openFile",
            file: file ?? "",
            ranges: code.selection,
        });
    const openDiff = () =>
        onOpenRequest({
            type: "openDiff",
            file: file ?? "",
            ranges: code.selection,
        });
    const openCode = file && !code.noFile ? openFile : undefined;

    const classes = [
        "card",
        "glass",
        open ? "" : "collapsed viewed-card",
        updated ? "updated" : "",
        openCode ? "opens" : "",
    ];
    return (
        <article
            className={classes.filter(Boolean).join(" ")}
            data-step={label}
            ref={box}
            {...hover}
            onClick={(event) => {
                if (openCode && opensCode(event.target)) {
                    openCode();
                }
            }}
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
                        viewed ? "Viewed (click to unfold)" : "Mark as viewed"
                    }
                    onClick={toggleViewed}
                >
                    <ChevronIcon />
                </button>
                <span className="step-no">{label}</span>
                {file && <FilePath path={file} />}
                <span className="actions">
                    <IconButton
                        label={
                            clarify
                                ? "Marked for clarification (click to unmark)"
                                : "Clarify: ask the agent to explain this step in smaller steps"
                        }
                        pressed={clarify}
                        onClick={() =>
                            onRequestChange(!clarify, comment || undefined)
                        }
                        text="Clarify"
                    >
                        <ClarifyIcon />
                    </IconButton>
                </span>
                {/* Always there on a step with code, folded or not, so nothing
                    beside them moves: greyed out, with the reason, when they
                    cannot be used. A text-only step has none. */}
                {file && (
                    <span className="actions open-actions">
                        <IconButton
                            label="Open the diff in the editor"
                            onClick={openDiff}
                            text="Diff"
                            unavailable={code.noDiff}
                        >
                            <DiffIcon />
                        </IconButton>
                        <IconButton
                            label="Open the file, with the changes selected"
                            onClick={openFile}
                            text="File"
                            unavailable={code.noFile}
                        >
                            <FileIcon />
                        </IconButton>
                    </span>
                )}
            </header>
            {open && (
                <>
                    <p className="why">{step.why}</p>
                    {step.examples?.map((example, index) => (
                        <Example key={index} example={example} />
                    ))}
                    {code.hunks.length > 0 && <DiffView hunks={code.hunks} />}
                    {file && code.hunks.length === 0 && (
                        <p className="no-diff">
                            No uncommitted changes in these lines.
                        </p>
                    )}
                </>
            )}
            {/* A comment stays visible even on a folded step, without its code. */}
            {writing || comment ? (
                <Note
                    comment={comment}
                    focus={writing}
                    onSave={(text) => onRequestChange(clarify, text)}
                    onDone={() => setWriting(false)}
                />
            ) : (
                open && (
                    <button
                        className="icon-btn comment-btn"
                        type="button"
                        title="Ask a question, or request a change"
                        onClick={() => setWriting(true)}
                    >
                        <CommentIcon />
                        <span>Comment</span>
                    </button>
                )
            )}
        </article>
    );
}

/**
 * A click on the card opens its code, except on the parts with a job of
 * their own (the header, examples, the inline diff, buttons, the comment) or when it
 * ends a text selection.
 */
function opensCode(target: EventTarget) {
    if (!(target instanceof Element)) {
        return false;
    }
    const own = target.closest(
        ".card-head, .example, .diff, button, textarea, a",
    );
    const selecting = (window.getSelection()?.toString() ?? "") !== "";
    return own === null && !selecting;
}
