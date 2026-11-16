import { useState } from "react";

import { changedRanges, type FileDiff, selectLines } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import type { ReviewRequest } from "../core/review";
import { type SourceLines, sourceHunks } from "../core/source";
import { Collapse } from "./Collapse";
import { DiffView } from "./DiffView";
import { DocLinks } from "./DocLinks";
import { Example } from "./Example";
import {
    ChevronIcon,
    ClarifyIcon,
    CommentIcon,
    DiffIcon,
    FileIcon,
    IconButton,
    WarningIcon,
} from "./Icons";
import { Note } from "./Note";
import { useKeyCommands } from "./useKeyboard";
import { useLabelsFit } from "./useLabelsFit";
import { useScrollAnchor } from "./useScrollAnchor";
import { useSeenOnHover } from "./useSeenOnHover";

/** Folder part fades and truncates first; the file name always stays visible. */
export function FilePath({ path }: { path: string }) {
    const split = path.lastIndexOf("/") + 1;
    return (
        <code className="chip" title={path}>
            <span className="dir">{path.slice(0, split)}</span>
            <span className="name">{path.slice(split)}</span>
        </code>
    );
}

/**
 * What a step shows and where the editor should land when it is opened: the
 * changed lines it chose, or, when it chose no change, that code as it is
 * now (existing code it explains).
 */
function useStepCode(
    step: Step,
    diffs: Record<string, FileDiff>,
    sources: Record<string, SourceLines>,
) {
    const file = step.file;
    const diff = file ? diffs[file] : undefined;
    // Exactly the lines the step chose, nothing around them.
    const ranges = step.lines ?? [];
    const changes = selectLines(diff, ranges);
    const changed = changes.some((hunk) =>
        hunk.lines.some((line) => line.kind !== "ctx"),
    );
    const existing = !changed && file ? sourceHunks(sources[file], ranges) : [];
    const unchanged = existing.length > 0;
    const hunks = unchanged ? existing : changes;
    // The editor selects only what changed, not the context shown around it;
    // a step that only removes code has no new-side lines, so it selects its range.
    const added = changedRanges(hunks);
    const selection = added.length > 0 ? added : ranges;
    const status = diff?.status;
    return {
        file,
        hunks,
        selection,
        unchanged,
        // Why a button cannot be used here; undefined when it can.
        noDiff: unchanged ? UNCHANGED : whyNoDiff(hunks.length, status),
        noFile: unchanged ? undefined : whyNoFile(hunks.length, status),
    };
}

const NO_CODE = "These lines are not in the file";
const UNCHANGED = "No diff: this code is unchanged";

/** A diff only makes sense when both sides exist. */
function whyNoDiff(hunks: number, status: FileDiff["status"] | undefined) {
    if (hunks === 0) {
        return NO_CODE;
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
        return NO_CODE;
    }
    return status === "deleted" ? "This file was deleted" : undefined;
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
    onViewedChange: (viewed: boolean) => void;
    /** The reader has looked at this updated step: clear its mark. */
    onSeen: () => void;
    onOpenRequest: (request: OpenRequest) => void;
    /** Open a documentation link in the browser. */
    onOpenUrl: (url: string) => void;
    onRequestChange: (clarify: boolean, comment: string | undefined) => void;
}) {
    const code = useStepCode(step, diffs, sources);
    const { file } = code;
    const clarify = request?.clarify ?? false;
    const comment = request?.comment ?? "";
    const [writing, setWriting] = useState(false);

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
    const toggleClarify = () => onRequestChange(!clarify, comment || undefined);

    useKeyCommands(box, {
        open: openCode,
        diff: file && !code.noDiff ? openDiff : undefined,
        toggle: toggleViewed,
        fold: viewed ? undefined : toggleViewed,
        unfold: viewed ? toggleViewed : undefined,
        clarify: toggleClarify,
        comment: () => setWriting(true),
    });

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
            data-nav="card"
            tabIndex={-1}
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
                        viewed
                            ? "Viewed (click to unfold) · za"
                            : "Mark as viewed · zc"
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
                {file && <FilePath path={file} />}
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
                {/* Always there on a step with code, folded or not, so nothing
                    beside them moves: greyed out, with the reason, when they
                    cannot be used. A text-only step has none. */}
                {file && (
                    <span className="actions open-actions">
                        <IconButton
                            label="Open the diff in the editor · gd"
                            onClick={openDiff}
                            text="Diff"
                            unavailable={code.noDiff}
                        >
                            <DiffIcon />
                        </IconButton>
                        <IconButton
                            label={
                                code.unchanged
                                    ? "Open the file at these lines · gf"
                                    : "Open the file, with the changes selected · gf"
                            }
                            onClick={openFile}
                            text="File"
                            unavailable={code.noFile}
                        >
                            <FileIcon />
                        </IconButton>
                    </span>
                )}
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
                    <p className="why">{step.why}</p>
                    {step.docs && (
                        <DocLinks docs={step.docs} onOpen={onOpenUrl} />
                    )}
                    {step.examples?.map((example, index) => (
                        <Example key={index} example={example} />
                    ))}
                    {code.hunks.length > 0 && (
                        <DiffView
                            hunks={code.hunks}
                            unchanged={code.unchanged}
                        />
                    )}
                    {file && code.hunks.length === 0 && (
                        <p className="no-diff">{NO_CODE}.</p>
                    )}
                    {!writing && !comment && (
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
            {/* A comment stays visible even on a folded step, without its code. */}
            {(writing || comment) && (
                <div className="card-note">
                    <Note
                        comment={comment}
                        focus={writing}
                        onSave={(text) => onRequestChange(clarify, text)}
                        onDone={() => setWriting(false)}
                        onLeave={() =>
                            box.current?.focus({ preventScroll: true })
                        }
                    />
                </div>
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
