/** A unified diff, parsed. Pure data: no git, no files. */

export type DiffLine = {
    kind: "add" | "del" | "ctx";
    text: string;
    oldNo?: number;
    newNo?: number;
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

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

type ParseState = {
    files: FileDiff[];
    file?: FileDiff;
    hunk?: Hunk;
    oldNo: number;
    newNo: number;
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
        addBodyLine(state, state.hunk, line);
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
    state.hunk = {
        oldStart: state.oldNo,
        newStart: state.newNo,
        newLines: Number(header[3] ?? 1),
        lines: [],
    };
    file.hunks.push(state.hunk);
}

function addBodyLine(state: ParseState, hunk: Hunk, line: string): void {
    const parsed = parseBodyLine(line, state.oldNo, state.newNo);
    if (!parsed) {
        return;
    }
    hunk.lines.push(parsed);
    state.oldNo += parsed.kind === "add" ? 0 : 1;
    state.newNo += parsed.kind === "del" ? 0 : 1;
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
): DiffLine | undefined {
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

/** Hunks that touch the new-side line range; all of them without a range. */
export function hunksForRange(
    diff: FileDiff | undefined,
    range?: readonly [number, number],
): Hunk[] {
    if (!diff) {
        return [];
    }
    if (!range) {
        return diff.hunks;
    }
    const [from, to] = range;
    return diff.hunks.filter((hunk) => {
        const end = hunk.newStart + Math.max(hunk.newLines, 1) - 1;
        return hunk.newStart <= to && end >= from;
    });
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

/** New-side line of the first change: where "Open in editor" should land. */
export function firstChangedLine(hunks: Hunk[]): number | undefined {
    const first = hunks[0];
    if (!first) {
        return undefined;
    }
    const added = first.lines.find((line) => line.kind === "add");
    return added?.newNo ?? first.newStart;
}
