import { useState } from "react";

import { changedRanges, type FileDiff, selectLines } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import type { ReviewRequest } from "../core/review";
import { DiffView } from "./DiffView";
import {
    ChevronIcon,
    ClarifyIcon,
    CommentIcon,
    DiffIcon,
    FileIcon,
    IconButton,
    TickIcon,
} from "./Icons";
import { Note } from "./Note";
import { useScrollAnchor } from "./useScrollAnchor";

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
        status,
        // Nothing to compare for a new file; nothing to open for a deleted one.
        canDiff: file !== undefined && hunks.length > 0 && status !== "added",
        canOpenFile:
            file !== undefined && hunks.length > 0 && status !== "deleted",
    };
}

export function StepCard({
    step,
    label,
    diffs,
    viewed,
    updated,
    request,
    onViewedChange,
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
            ref={box}
        >
            {/* The whole header toggles Viewed; its own controls keep their jobs. */}
            <header
                className="card-head"
                ref={head}
                onClick={(event) => {
                    const own =
                        event.target instanceof Element &&
                        event.target.closest("button, label, a");
                    if (!own) {
                        toggleViewed();
                    }
                }}
            >
                <span className="chev" aria-hidden="true">
                    <ChevronIcon />
                </span>
                <span className="step-no">{label}</span>
                {updated && (
                    <span
                        className="updated-tag"
                        title="New or changed since you last looked"
                    >
                        <TickIcon />
                    </span>
                )}
                {file && <FilePath path={file} />}
                <span className="actions">
                    {open && code.canDiff && (
                        <IconButton
                            label="Open the diff in the editor"
                            onClick={() =>
                                onOpenRequest({
                                    type: "openDiff",
                                    file: file ?? "",
                                    ranges: code.selection,
                                    status: code.status,
                                })
                            }
                            text="Diff"
                        >
                            <DiffIcon />
                        </IconButton>
                    )}
                    {open && code.canOpenFile && (
                        <IconButton
                            label="Open the file, with the changes selected"
                            onClick={() =>
                                onOpenRequest({
                                    type: "openFile",
                                    file: file ?? "",
                                    ranges: code.selection,
                                })
                            }
                            text="File"
                        >
                            <FileIcon />
                        </IconButton>
                    )}
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
                    <IconButton
                        label={comment ? "Edit your comment" : "Comment"}
                        pressed={comment !== ""}
                        onClick={() => setWriting(true)}
                        text="Comment"
                    >
                        <CommentIcon />
                    </IconButton>
                </span>
                <label className="viewed">
                    <input
                        type="checkbox"
                        checked={viewed}
                        onChange={toggleViewed}
                    />
                    <span>Viewed</span>
                </label>
            </header>
            {open && (
                <>
                    <p className="why">{step.why}</p>
                    {code.hunks.length > 0 && <DiffView hunks={code.hunks} />}
                    {file && code.hunks.length === 0 && (
                        <p className="no-diff">
                            No uncommitted changes in these lines.
                        </p>
                    )}
                </>
            )}
            {/* A comment stays visible even on a folded step, without its code. */}
            {(writing || comment) && (
                <Note
                    comment={comment}
                    focus={writing}
                    onSave={(text) => onRequestChange(clarify, text)}
                    onDone={() => setWriting(false)}
                />
            )}
        </article>
    );
}
