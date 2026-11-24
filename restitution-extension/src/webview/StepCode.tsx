import type { ReactNode } from "react";

import { hunkSelection } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { FileRun } from "../core/source";
import type { CodeBlock } from "./DiffView";
import { DiffIcon, FileIcon, IconButton } from "./Icons";

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

const NO_CODE = "These lines are not in the file";
const UNCHANGED = "No diff: this code is unchanged";

/**
 * Where a new file starts in a card's code: its name, and its Diff and File
 * (greyed out, with the reason, when they cannot be used).
 */
function FileHead({
    file,
    unchanged,
    noDiff,
    noFile,
    onDiff,
    onFile,
}: {
    file: string;
    unchanged: boolean;
    noDiff: string | undefined;
    noFile: string | undefined;
    onDiff: () => void;
    onFile: () => void;
}) {
    return (
        <div className="file-head">
            <FilePath path={file} />
            {unchanged && <span className="file-tag">Unchanged code</span>}
            <span className="actions">
                <IconButton
                    label="Open the diff in the editor · gd"
                    onClick={onDiff}
                    unavailable={noDiff}
                >
                    <DiffIcon />
                </IconButton>
                <IconButton
                    label={
                        unchanged
                            ? "Open the file at these lines · gf"
                            : "Open the file, with the changes selected · gf"
                    }
                    onClick={onFile}
                    unavailable={noFile}
                >
                    <FileIcon />
                </IconButton>
            </span>
        </div>
    );
}

/**
 * What a run of code in one file can open, and why not: a diff only makes
 * sense when both sides exist, and a deleted file has nothing to open.
 */
function runActions(run: FileRun) {
    const hunks = run.places.flatMap((place) => place.hunks);
    const unchanged = run.places.every(
        (place) => place.unchanged || place.hunks.length === 0,
    );
    let noDiff: string | undefined;
    if (hunks.length === 0) {
        noDiff = NO_CODE;
    } else if (unchanged) {
        noDiff = UNCHANGED;
    } else if (run.status === "added") {
        noDiff = "No diff: this file is new, every line is added";
    } else if (run.status === "deleted") {
        noDiff = "No diff: this file was deleted, every line is removed";
    }
    let noFile: string | undefined;
    if (hunks.length === 0) {
        noFile = NO_CODE;
    } else if (run.status === "deleted" && !unchanged) {
        noFile = "This file was deleted";
    }
    return {
        noDiff,
        noFile,
        unchanged,
        // The editor selects what changed in the run, or the run's lines.
        selection: run.places.flatMap((place) => place.selection),
    };
}

type Open = (
    type: OpenRequest["type"],
    file: string,
    ranges: OpenRequest["ranges"],
) => void;

/**
 * A step's code as blocks for the card, a file header wherever a new file
 * starts, and what Enter, `gf` and `gd` open on the card itself: the first
 * file that can be opened, the first that has a diff.
 */
export function stepCode(
    runs: FileRun[],
    onOpenRequest: (request: OpenRequest) => void,
): { blocks: CodeBlock[]; openCode?: () => void; openDiff?: () => void } {
    const openAt: Open = (type, file, ranges) =>
        onOpenRequest({ type, file, ranges });
    const entries = runs.map((run) => ({ run, ...runActions(run) }));
    const firstFile = entries.find((entry) => !entry.noFile);
    const firstDiff = entries.find((entry) => !entry.noDiff);
    return {
        blocks: entries.flatMap((entry, r) => runBlocks(entry, r, openAt)),
        openCode: firstFile
            ? () => openAt("openFile", firstFile.run.file, firstFile.selection)
            : undefined,
        openDiff: firstDiff
            ? () => openAt("openDiff", firstDiff.run.file, firstDiff.selection)
            : undefined,
    };
}

/** The blocks of one run, the first under the file's header. */
function runBlocks(
    entry: { run: FileRun } & ReturnType<typeof runActions>,
    r: number,
    openAt: Open,
): CodeBlock[] {
    const { file } = entry.run;
    const head = (unchanged: boolean): ReactNode => (
        <FileHead
            file={file}
            unchanged={unchanged}
            noDiff={entry.noDiff}
            noFile={entry.noFile}
            onDiff={() => openAt("openDiff", file, entry.selection)}
            onFile={() => openAt("openFile", file, entry.selection)}
        />
    );
    return entry.run.places.flatMap((place, p) => {
        // Lines that are not in the file still get a block, saying so.
        const hunks = place.hunks.length > 0 ? place.hunks : [undefined];
        return hunks.map((hunk, h) => ({
            key: `${r}-${p}-${h}`,
            hunk,
            unchanged: place.unchanged,
            head: p === 0 && h === 0 ? head(place.unchanged) : undefined,
            open:
                hunk && !entry.noFile
                    ? () => openAt("openFile", file, hunkSelection(hunk))
                    : undefined,
            diff:
                hunk && !entry.noDiff && !place.unchanged
                    ? () => openAt("openDiff", file, hunkSelection(hunk))
                    : undefined,
        }));
    });
}
