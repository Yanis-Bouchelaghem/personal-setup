import { useLayoutEffect, useRef, useState } from "react";

import { type FileDiff, firstChangedLine, hunksForRange } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import { DiffView } from "./DiffView";
import { ChevronIcon, DiffIcon, FileIcon, IconButton } from "./Icons";

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

export function StepCard({
    step,
    label,
    diffs,
    viewed,
    onViewedChange,
    onOpenRequest,
}: {
    step: Step;
    label: string;
    diffs: Record<string, FileDiff>;
    viewed: boolean;
    onViewedChange: (viewed: boolean) => void;
    onOpenRequest: (request: OpenRequest) => void;
}) {
    const file = step.file;
    const diff = file ? diffs[file] : undefined;
    const hunks = hunksForRange(diff, step.lines);
    const line = firstChangedLine(hunks);
    const status = diff?.status;
    // Nothing to compare for a new file; nothing to open for a deleted one.
    const canDiff =
        file !== undefined && hunks.length > 0 && status !== "added";
    const canOpenFile =
        file !== undefined && hunks.length > 0 && status !== "deleted";

    const [open, setOpen] = useState(!viewed);
    const card = useRef<HTMLElement>(null);
    const head = useRef<HTMLElement>(null);
    const anchor = useRef<number | undefined>(undefined);

    // Folding changes the card's height. Put it back where its header was, so
    // what you were reading doesn't jump (the header is pinned while you read).
    useLayoutEffect(() => {
        if (anchor.current !== undefined && card.current) {
            const drift =
                card.current.getBoundingClientRect().top - anchor.current;
            window.scrollBy(0, drift);
            anchor.current = undefined;
        }
    }, [open]);

    const change = (next: boolean) => {
        if (next !== open) {
            anchor.current = head.current?.getBoundingClientRect().top;
            setOpen(next);
        }
    };
    const toggleViewed = (checked: boolean) => {
        onViewedChange(checked);
        change(!checked); // viewed folds the card; un-viewing opens it again
    };

    return (
        <article
            className={`card glass${open ? "" : " collapsed"}${viewed ? " viewed-card" : ""}`}
            ref={card}
        >
            <header className="card-head" ref={head}>
                <button
                    className="chev"
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? "Fold this step" : "Unfold this step"}
                    title={open ? "Fold" : "Unfold"}
                    onClick={() => change(!open)}
                >
                    <ChevronIcon />
                </button>
                <span className="step-no">{label}</span>
                {file && <FilePath path={file} />}
                <span className="actions">
                    {open && canDiff && (
                        <IconButton
                            label="Open the diff in the editor"
                            onClick={() =>
                                onOpenRequest({
                                    type: "openDiff",
                                    file,
                                    line,
                                    status,
                                })
                            }
                        >
                            <DiffIcon />
                        </IconButton>
                    )}
                    {open && canOpenFile && (
                        <IconButton
                            label={`Open the file${line ? ` at line ${line}` : ""}`}
                            onClick={() =>
                                onOpenRequest({ type: "openFile", file, line })
                            }
                        >
                            <FileIcon />
                        </IconButton>
                    )}
                </span>
                <label className="viewed">
                    <input
                        type="checkbox"
                        checked={viewed}
                        onChange={(event) => toggleViewed(event.target.checked)}
                    />
                    <span>Viewed</span>
                </label>
            </header>
            {open && (
                <>
                    <p className="why">{step.why}</p>
                    {step.because && <p className="because">{step.because}</p>}
                    {hunks.length > 0 && <DiffView hunks={hunks} />}
                    {file && hunks.length === 0 && (
                        <p className="no-diff">
                            No uncommitted changes in this file
                            {step.lines ? " range" : ""}.
                        </p>
                    )}
                </>
            )}
        </article>
    );
}
