import { useState } from "react";

import type { Uncovered } from "../core/coverage";
import { changedRanges } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import { Collapse } from "./Collapse";
import { DiffView } from "./DiffView";
import { ChevronIcon, DiffIcon, FileIcon, IconButton } from "./Icons";
import { FilePath } from "./StepCard";

/** How many changed lines (added or removed) these entries hold. */
export function countChanged(entries: readonly Uncovered[]): number {
    return entries.reduce(
        (sum, entry) =>
            sum +
            entry.hunks
                .flatMap((hunk) => hunk.lines)
                .filter((line) => line.kind !== "ctx").length,
        0,
    );
}

/**
 * The end of a tab: uncommitted changes that no guide shows, so the reader
 * knows what reading only the guides would miss. Folded until asked for.
 */
export function UncoveredSection({
    entries,
    open,
    onToggle,
    onOpenRequest,
}: {
    entries: readonly Uncovered[];
    open: boolean;
    onToggle: () => void;
    onOpenRequest: (request: OpenRequest) => void;
}) {
    if (entries.length === 0) {
        return null;
    }
    const lines = countChanged(entries);
    return (
        <section
            className={open ? "uncovered" : "uncovered folded"}
            id="uncovered"
        >
            <h2 className="uncovered-head">
                <button
                    className="goal-toggle"
                    type="button"
                    aria-expanded={open}
                    onClick={onToggle}
                >
                    <span className="chev" aria-hidden="true">
                        <ChevronIcon />
                    </span>
                    <span className="goal-title">Changed, but in no guide</span>
                    <span className="goal-progress">
                        {lines} {lines === 1 ? "line" : "lines"} ·{" "}
                        {entries.length}{" "}
                        {entries.length === 1 ? "file" : "files"}
                    </span>
                </button>
            </h2>
            <Collapse open={open}>
                <div className="uncovered-list">
                    {entries.map((entry) => (
                        <UncoveredFile
                            key={entry.file}
                            entry={entry}
                            onOpenRequest={onOpenRequest}
                        />
                    ))}
                </div>
            </Collapse>
        </section>
    );
}

function UncoveredFile({
    entry,
    onOpenRequest,
}: {
    entry: Uncovered;
    onOpenRequest: (request: OpenRequest) => void;
}) {
    const [open, setOpen] = useState(true);
    // Select what was added; a removal only has its position.
    const changed = changedRanges(entry.hunks);
    const ranges = changed.length > 0 ? changed : entry.ranges;
    const openFile = () =>
        onOpenRequest({ type: "openFile", file: entry.file, ranges });
    const openDiff = () =>
        onOpenRequest({ type: "openDiff", file: entry.file, ranges });
    const canOpen = entry.status !== "deleted";
    const classes = [
        "card",
        "glass",
        "uncovered-card",
        open ? "" : "collapsed",
        canOpen ? "opens" : "",
    ];
    return (
        <article
            className={classes.filter(Boolean).join(" ")}
            onClick={(event) => {
                if (canOpen && opensFile(event.target)) {
                    openFile();
                }
            }}
        >
            {/* The header folds the card; its buttons keep their jobs. */}
            <header
                className="card-head"
                onClick={(event) => {
                    const own =
                        event.target instanceof Element &&
                        event.target.closest("button, a");
                    if (!own) {
                        setOpen(!open);
                    }
                }}
            >
                <button
                    className="chev chev-btn"
                    type="button"
                    aria-expanded={open}
                    title={open ? "Fold" : "Unfold"}
                    onClick={() => setOpen(!open)}
                >
                    <ChevronIcon />
                </button>
                <FilePath path={entry.file} />
                <span className="actions open-actions">
                    <IconButton
                        label="Open the diff in the editor"
                        onClick={openDiff}
                        unavailable={
                            entry.status === "modified"
                                ? undefined
                                : `No diff: this file was ${entry.status === "added" ? "added" : "deleted"}`
                        }
                    >
                        <DiffIcon />
                    </IconButton>
                    <IconButton
                        label="Open the file, with these changes selected"
                        onClick={openFile}
                        unavailable={
                            canOpen ? undefined : "This file was deleted"
                        }
                    >
                        <FileIcon />
                    </IconButton>
                </span>
            </header>
            <Collapse open={open}>
                <div className="card-body">
                    <DiffView hunks={entry.hunks} />
                </div>
            </Collapse>
        </article>
    );
}

/**
 * A click on the card opens the file, except on the header and buttons, or
 * when it ends a text selection. Here the code itself opens it too: there is
 * no explanation to click.
 */
function opensFile(target: EventTarget): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    const own = target.closest(".card-head, button, a");
    const selecting = (window.getSelection()?.toString() ?? "") !== "";
    return own === null && !selecting;
}
