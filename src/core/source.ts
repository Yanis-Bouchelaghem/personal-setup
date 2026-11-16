import { type FileDiff, type Hunk, type LineRange, selectLines } from "./diff";
import type { Restitution, Step } from "./restitution";

/**
 * Code a step points at without changing it: existing code the change relies
 * on, or code the user asked to have explained. It is not in the diff, so it
 * is read from the file as it is now, keeping only the lines steps ask for.
 */
export type SourceLines = Readonly<Record<number, string>>;

/** A step that points at code: it has both a file and line ranges. */
export type AnchoredStep = Step & { file: string; lines: LineRange[] };

function isAnchored(step: Step): step is AnchoredStep {
    return step.file !== undefined && step.lines !== undefined;
}

/** Whether a step's lines hold a change: an added or removed line. */
export function showsChange(
    step: Step,
    diffs: Record<string, FileDiff>,
): boolean {
    return selectLines(
        step.file ? diffs[step.file] : undefined,
        step.lines ?? [],
    ).some((hunk) => hunk.lines.some((line) => line.kind !== "ctx"));
}

/** Steps that point at code but hold no change, in order. */
export function unchangedSteps(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
): AnchoredStep[] {
    return restitution.goals
        .flatMap((goal) => goal.steps)
        .filter(isAnchored)
        .filter((step) => !showsChange(step, diffs));
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
 * hunk per run of consecutive lines. Lines the file doesn't have are left out.
 */
export function sourceHunks(
    source: SourceLines | undefined,
    ranges: readonly LineRange[],
): Hunk[] {
    if (!source) {
        return [];
    }
    // From the lines that were read, never from the ranges: a range can be huge.
    const positions = Object.keys(source)
        .map(Number)
        .filter((at) => ranges.some(([from, to]) => at >= from && at <= to))
        .toSorted((a, b) => a - b);
    const hunks: Hunk[] = [];
    for (const at of positions) {
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
}
