/** A unified diff, parsed. Pure data: no git, no files. */

export type DiffLine = {
    kind: "add" | "del" | "ctx";
    text: string;
    oldNo?: number;
    newNo?: number;
    /**
     * The line number a step's `lines` range is matched against: the new-side
     * number for added and context lines; for a removed line, the new-side
     * line just before it (so it sits with its neighbours); for a deleted
     * file, the old-side number, the only one that exists.
     */
    at: number;
};

export type Hunk = {
    oldStart: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
};

export type FileDiff = {
    file: string;
    status: "modified" | "added" | "deleted";
    hunks: Hunk[];
};

/** Inclusive line numbers: [from, to]. */
export type LineRange = readonly [number, number];

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

type ParseState = {
    files: FileDiff[];
    file?: FileDiff;
    hunk?: Hunk;
    oldNo: number;
    newNo: number;
    /** The last new-side line seen in this hunk, for removed lines to sit by. */
    lastNew?: number;
};

/** Parse the output of `git diff` (any number of files). */
export function parseUnifiedDiff(text: string): FileDiff[] {
    const state: ParseState = { files: [], oldNo: 0, newNo: 0 };
    for (const line of text.split("\n")) {
        readLine(state, line);
    }
    return state.files.filter((f) => f.file !== "");
}

function readLine(state: ParseState, line: string): void {
    if (line.startsWith("diff --git ")) {
        state.file = { file: "", status: "modified", hunks: [] };
        state.files.push(state.file);
        state.hunk = undefined;
        return;
    }
    if (!state.file) {
        return;
    }
    const header = HUNK_HEADER.exec(line);
    if (header) {
        openHunk(state, state.file, header);
    } else if (state.hunk) {
        addBodyLine(state, state.file, state.hunk, line);
    } else {
        applyFileHeader(state.file, line);
    }
}

function openHunk(
    state: ParseState,
    file: FileDiff,
    header: RegExpExecArray,
): void {
    state.oldNo = Number(header[1]);
    state.newNo = Number(header[2]);
    state.lastNew = undefined;
    state.hunk = {
        oldStart: state.oldNo,
        newStart: state.newNo,
        newLines: Number(header[3] ?? 1),
        lines: [],
    };
    file.hunks.push(state.hunk);
}

function addBodyLine(
    state: ParseState,
    file: FileDiff,
    hunk: Hunk,
    line: string,
): void {
    const parsed = parseBodyLine(line, state.oldNo, state.newNo);
    if (!parsed) {
        return;
    }
    const at = positionOf(parsed, file, state.lastNew ?? hunk.newStart);
    hunk.lines.push({ ...parsed, at });
    if (parsed.kind !== "del") {
        state.lastNew = parsed.newNo;
    }
    state.oldNo += parsed.kind === "add" ? 0 : 1;
    state.newNo += parsed.kind === "del" ? 0 : 1;
}

function positionOf(
    line: Omit<DiffLine, "at">,
    file: FileDiff,
    beside: number,
): number {
    if (file.status === "deleted") {
        return line.oldNo ?? 0;
    }
    return line.kind === "del" ? beside : (line.newNo ?? beside);
}

function applyFileHeader(file: FileDiff, line: string): void {
    if (line.startsWith("new file mode")) {
        file.status = "added";
    } else if (line.startsWith("deleted file mode")) {
        file.status = "deleted";
    } else if (line.startsWith("+++ b/")) {
        file.file = line.slice("+++ b/".length);
    } else if (line.startsWith("--- a/") && file.file === "") {
        file.file = line.slice("--- a/".length);
    }
}

function parseBodyLine(
    line: string,
    oldNo: number,
    newNo: number,
): Omit<DiffLine, "at"> | undefined {
    const marker = line[0];
    const text = line.slice(1);
    if (marker === "+") {
        return { kind: "add", text, newNo };
    }
    if (marker === "-") {
        return { kind: "del", text, oldNo };
    }
    if (marker === " ") {
        return { kind: "ctx", text, oldNo, newNo };
    }
    return undefined; // "\ No newline at end of file", blank trailer
}

/**
 * The ranges in the order the step lists them, which is the order the reader
 * sees them (a call site before the definition it calls, say). Ranges that
 * overlap or touch merge into the first of them, so nothing shows twice.
 */
export function readingOrder(ranges: readonly LineRange[]): LineRange[] {
    const merged: [number, number][] = [];
    for (const [from, to] of ranges) {
        const near = merged.find(([a, b]) => from <= b + 1 && to >= a - 1);
        if (near) {
            near[0] = Math.min(near[0], from);
            near[1] = Math.max(near[1], to);
        } else {
            merged.push([from, to]);
        }
    }
    return merged;
}

/**
 * Exactly the lines of a diff that fall in the ranges, as hunks, in the
 * ranges' reading order: a hunk is cut wherever a line is left out, so a
 * step shows what it chose and no more. The lines are the diff's own
 * objects, so callers can tell which were shown.
 */
export function selectLines(
    diff: FileDiff | undefined,
    ranges: readonly LineRange[],
): Hunk[] {
    if (!diff) {
        return [];
    }
    return readingOrder(ranges).flatMap(([from, to]) =>
        diff.hunks.flatMap((hunk) =>
            runsOf(hunk.lines, (line) => line.at >= from && line.at <= to).map(
                toHunk,
            ),
        ),
    );
}

/** Consecutive lines that satisfy `keep`, each run on its own. */
function runsOf(lines: DiffLine[], keep: (line: DiffLine) => boolean) {
    const runs: DiffLine[][] = [];
    let current: DiffLine[] = [];
    for (const line of lines) {
        if (keep(line)) {
            current.push(line);
        } else if (current.length > 0) {
            runs.push(current);
            current = [];
        }
    }
    if (current.length > 0) {
        runs.push(current);
    }
    return runs;
}

function toHunk(lines: DiffLine[]): Hunk {
    const [first] = lines;
    return {
        oldStart: lines.find((line) => line.oldNo !== undefined)?.oldNo ?? 0,
        newStart: first?.newNo ?? first?.at ?? 0,
        newLines: lines.filter((line) => line.newNo !== undefined).length,
        lines,
    };
}

/**
 * The lines a step actually changed, as ranges on the new side: each run of
 * consecutive added lines, with unchanged code between runs left out. Removed
 * lines have no new-side number, so a step that only removes code gives none.
 */
export function changedRanges(hunks: Hunk[]): LineRange[] {
    const runs: [number, number][] = [];
    for (const line of hunks.flatMap((hunk) => hunk.lines)) {
        if (line.kind !== "add" || line.newNo === undefined) {
            continue;
        }
        const last = runs.at(-1);
        if (last && line.newNo === last[1] + 1) {
            last[1] = line.newNo;
        } else {
            runs.push([line.newNo, line.newNo]);
        }
    }
    return runs;
}

/**
 * What opening one block of code selects: its changed lines, or, when it
 * changes none on the new side (unchanged code, or only removals), the whole
 * block.
 */
export function hunkSelection(hunk: Hunk): LineRange[] {
    const changed = changedRanges([hunk]);
    if (changed.length > 0) {
        return changed;
    }
    const positions = hunk.lines.map((line) => line.at);
    return positions.length > 0
        ? [[Math.min(...positions), Math.max(...positions)]]
        : [];
}

/** The first `max` lines across hunks, keeping hunk boundaries. */
export function takeLines(hunks: Hunk[], max: number): Hunk[] {
    const out: Hunk[] = [];
    let left = max;
    for (const hunk of hunks) {
        if (left <= 0) {
            break;
        }
        out.push({ ...hunk, lines: hunk.lines.slice(0, left) });
        left -= hunk.lines.length;
    }
    return out;
}

export function countLines(hunks: Hunk[]): number {
    return hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
}
