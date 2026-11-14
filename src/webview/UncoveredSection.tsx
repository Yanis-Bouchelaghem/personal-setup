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
    // Select what was added; a removal only has its position.
    const changed = changedRanges(entry.hunks);
    const ranges = changed.length > 0 ? changed : entry.ranges;
    return (
        <article className="uncovered-file glass">
            <header className="uncovered-file-head">
                <FilePath path={entry.file} />
                <span className="actions">
                    <IconButton
                        label="Open the diff in the editor"
                        onClick={() =>
                            onOpenRequest({
                                type: "openDiff",
                                file: entry.file,
                                ranges,
                            })
                        }
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
                        onClick={() =>
                            onOpenRequest({
                                type: "openFile",
                                file: entry.file,
                                ranges,
                            })
                        }
                        unavailable={
                            entry.status === "deleted"
                                ? "This file was deleted"
                                : undefined
                        }
                    >
                        <FileIcon />
                    </IconButton>
                </span>
            </header>
            <DiffView hunks={entry.hunks} />
        </article>
    );
}
