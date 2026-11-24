import {
    changedRanges,
    describeRanges,
    type FileDiff,
    type Hunk,
    type LineRange,
    readingOrder,
    selectLines,
} from "./diff";
import type { Place, Restitution, Step } from "./restitution";

/**
 * Code a step points at without changing it: existing code the change relies
 * on, or code the user asked to have explained. It is not in the diff, so it
 * is read from the file as it is now, keeping only the lines steps ask for.
 */
export type SourceLines = Readonly<Record<number, string>>;

/** "src/a.ts:3,31-33": a place, as the agent reads it back. */
export function describePlace(place: Place): string {
    return `${place.file}:${describeRanges(place.lines)}`;
}

/** Whether a place's lines hold a change: an added or removed line. */
export function showsChange(
    place: Place,
    diffs: Record<string, FileDiff>,
): boolean {
    return selectLines(diffs[place.file], place.lines).some((hunk) =>
        hunk.lines.some((line) => line.kind !== "ctx"),
    );
}

/** Every place the steps show, in order. */
export function places(restitution: Restitution): Place[] {
    return restitution.goals.flatMap((goal) =>
        goal.steps.flatMap((step) => step.code ?? []),
    );
}

/** Places that hold no change, in order: existing code, or wrong anchors. */
export function unchangedPlaces(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
): Place[] {
    return places(restitution).filter((place) => !showsChange(place, diffs));
}

/** The changed lines a step shows, all its places together. */
export function stepHunks(step: Step, diffs: Record<string, FileDiff>): Hunk[] {
    return (step.code ?? []).flatMap((place) =>
        selectLines(diffs[place.file], place.lines),
    );
}

/**
 * What one place shows: the changed lines it chose, or, when they hold no
 * change, that code as it is now (existing code it explains). No hunks when
 * the lines are not in the file.
 */
export type PlaceCode = {
    file: string;
    status: FileDiff["status"] | undefined;
    unchanged: boolean;
    hunks: Hunk[];
    /**
     * What the editor selects when the place is opened: only what changed
     * (a place that only removes code has no new-side lines: its ranges).
     */
    selection: LineRange[];
};

export function placeCode(
    place: Place,
    diffs: Record<string, FileDiff>,
    sources: Record<string, SourceLines>,
): PlaceCode {
    const diff = diffs[place.file];
    const changes = selectLines(diff, place.lines);
    const changed = changes.some((hunk) =>
        hunk.lines.some((line) => line.kind !== "ctx"),
    );
    const existing = changed
        ? []
        : sourceHunks(sources[place.file], place.lines);
    const unchanged = existing.length > 0;
    const hunks = unchanged ? existing : changes;
    const added = changedRanges(hunks);
    return {
        file: place.file,
        status: diff?.status,
        unchanged,
        hunks,
        selection: added.length > 0 ? added : place.lines,
    };
}

/**
 * A step's places, with the ones next to each other in the same file put
 * together: the card gives each run one file header, and separates the
 * blocks inside it by their line.
 */
export type FileRun = {
    file: string;
    status: FileDiff["status"] | undefined;
    places: PlaceCode[];
};

export function fileRuns(
    step: Step,
    diffs: Record<string, FileDiff>,
    sources: Record<string, SourceLines>,
): FileRun[] {
    const runs: FileRun[] = [];
    for (const place of step.code ?? []) {
        const code = placeCode(place, diffs, sources);
        const last = runs.at(-1);
        if (last?.file === code.file) {
            last.places.push(code);
        } else {
            runs.push({ file: code.file, status: code.status, places: [code] });
        }
    }
    return runs;
}

/** A file's lines; the newline that ends the file does not start a line. */
export function splitLines(text: string): string[] {
    const lines = text.split(/\r?\n/);
    if (lines.at(-1) === "") {
        lines.pop();
    }
    return lines;
}

/** The lines the ranges ask for, by line number, from a file's lines. */
export function pickLines(
    lines: readonly string[],
    ranges: readonly LineRange[],
): Record<number, string> {
    const picked: Record<number, string> = {};
    for (const [from, to] of ranges) {
        for (
            let at = Math.max(1, from);
            at <= Math.min(to, lines.length);
            at++
        ) {
            picked[at] = lines[at - 1] ?? "";
        }
    }
    return picked;
}

/**
 * Unchanged code as hunks of context lines, so it shows like the rest: one
 * hunk per run of consecutive lines, in the ranges' reading order. Lines the
 * file doesn't have are left out.
 */
export function sourceHunks(
    source: SourceLines | undefined,
    ranges: readonly LineRange[],
): Hunk[] {
    if (!source) {
        return [];
    }
    // From the lines that were read, never from the ranges: a range can be huge.
    const read = Object.keys(source)
        .map(Number)
        .toSorted((a, b) => a - b);
    return readingOrder(ranges).flatMap(([from, to]) => {
        const hunks: Hunk[] = [];
        for (const at of read.filter((n) => n >= from && n <= to)) {
            const line = {
                kind: "ctx" as const,
                text: source[at] ?? "",
                oldNo: at,
                newNo: at,
                at,
            };
            const last = hunks.at(-1);
            if (last && at === last.newStart + last.newLines) {
                last.lines.push(line);
                last.newLines++;
            } else {
                hunks.push({
                    oldStart: at,
                    newStart: at,
                    newLines: 1,
                    lines: [line],
                });
            }
        }
        return hunks;
    });
}
