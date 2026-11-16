import {
    type DiffLine,
    type FileDiff,
    type Hunk,
    type LineRange,
    selectLines,
} from "./diff";
import { type Restitution, tabLabel } from "./restitution";
import { unchangedSteps } from "./source";

export type Coverage = {
    /** Steps showing only unchanged code that exists, as "file:lines". */
    unchanged: string[];
    /** Steps pointing at a file or lines that don't exist, as "file:lines". */
    nowhere: string[];
    /** Changed lines no step shows, as "file:lines". */
    unexplained: string[];
};

/** "12", "12-15", or a comma list of those. */
function describeRanges(ranges: readonly LineRange[]): string {
    return ranges
        .map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`))
        .join(",");
}

/** Positions in order, as runs of neighbours: [3,4,5,9] -> [[3,5],[9,9]]. */
function runsOfPositions(positions: number[]): LineRange[] {
    const sorted = [...new Set(positions)].toSorted((a, b) => a - b);
    const runs: [number, number][] = [];
    for (const position of sorted) {
        const last = runs.at(-1);
        if (last && position <= last[1] + 1) {
            last[1] = position;
        } else {
            runs.push([position, position]);
        }
    }
    return runs;
}

/** Every diff line some step of these restitutions shows. */
function shownLines(
    restitutions: readonly Restitution[],
    diffs: Record<string, FileDiff>,
): Set<DiffLine> {
    const shown = new Set<DiffLine>();
    for (const step of restitutions.flatMap((r) =>
        r.goals.flatMap((goal) => goal.steps),
    )) {
        if (step.file && step.lines) {
            for (const hunk of selectLines(diffs[step.file], step.lines)) {
                hunk.lines.forEach((line) => shown.add(line));
            }
        }
    }
    return shown;
}

/** A file's changed lines that no step shows, as runs of positions. */
function hiddenRanges(diff: FileDiff, shown: Set<DiffLine>): LineRange[] {
    return runsOfPositions(
        diff.hunks
            .flatMap((hunk) => hunk.lines)
            .filter((line) => line.kind !== "ctx" && !shown.has(line))
            .map((line) => line.at),
    );
}

/**
 * Compare a restitution's steps with the working-tree diffs, line by line. A
 * changed line counts as shown when any restitution's step shows it (`others`
 * are the other tabs). Steps whose lines hold no change are only reported for
 * `restitution`, split by `lineCounts` (how many lines each of their files
 * has; absent when it doesn't exist) into existing code and wrong anchors.
 */
export function checkCoverage(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
    others: Restitution[] = [],
    lineCounts: Readonly<Record<string, number>> = {},
): Coverage {
    const unchanged: string[] = [];
    const nowhere: string[] = [];
    for (const step of unchangedSteps(restitution, diffs)) {
        const count = lineCounts[step.file];
        const exists =
            count !== undefined &&
            step.lines.every(([from, to]) => from >= 1 && to <= count);
        (exists ? unchanged : nowhere).push(
            `${step.file}:${describeRanges(step.lines)}`,
        );
    }

    const shown = shownLines([restitution, ...others], diffs);
    const unexplained = Object.values(diffs).flatMap((diff) => {
        const hidden = hiddenRanges(diff, shown);
        return hidden.length === 0
            ? []
            : [`${diff.file}:${describeRanges(hidden)}`];
    });
    return { unchanged, nowhere, unexplained };
}

/** Changed code that no guide shows, in one file. */
export type Uncovered = {
    file: string;
    status: FileDiff["status"];
    /** The positions of those lines, for opening the editor on them. */
    ranges: LineRange[];
    /** The lines themselves, to display. */
    hunks: Hunk[];
};

/**
 * The changed lines no step of any of these restitutions shows, file by file:
 * what the reader would miss by reading only the guides. Purely a line diff,
 * so it works for any language.
 */
export function uncoveredChanges(
    diffs: Record<string, FileDiff>,
    restitutions: readonly Restitution[],
): Uncovered[] {
    const shown = shownLines(restitutions, diffs);
    return Object.values(diffs)
        .map((diff) => {
            const ranges = hiddenRanges(diff, shown);
            return {
                file: diff.file,
                status: diff.status,
                ranges,
                hunks: selectLines(diff, ranges),
            };
        })
        .filter((entry) => entry.ranges.length > 0)
        .toSorted((a, b) => a.file.localeCompare(b.file));
}

/** What the agent reads back after submitting. Warnings never block. */
export function describeSubmit(
    restitution: Restitution,
    coverage: Coverage | undefined,
    /** Steps left as they were whose code changed since they were written. */
    stale: readonly string[] = [],
): string {
    const steps = restitution.goals.reduce((n, g) => n + g.steps.length, 0);
    const lines = [
        `Saved: ${restitution.goals.length} goals, ${steps} steps, as the tab "${tabLabel(restitution)}" in the user's Restitution panel.`,
    ];
    if (!coverage) {
        lines.push("Could not read the git diff, so coverage was not checked.");
        return lines.join("\n");
    }
    if (coverage.nowhere.length > 0) {
        lines.push(
            `Steps pointing at lines that don't exist (wrong file, or wrong line numbers): ${coverage.nowhere.join(", ")}.`,
        );
    }
    if (coverage.unchanged.length > 0) {
        lines.push(
            `Steps showing only unchanged code: ${coverage.unchanged.join(", ")}. Fine when they explain existing code; otherwise check their line numbers.`,
        );
    }
    if (coverage.unexplained.length > 0) {
        lines.push(
            `Changed lines no step shows: ${coverage.unexplained.join(", ")}. Widen a step's "lines" to include them, or add a step.`,
        );
    }
    if (stale.length > 0) {
        lines.push(
            stale.length === 1
                ? `The code of step ${stale[0]} changed since you explained it: check that its "why" still holds.`
                : `The code of steps ${stale.join(", ")} changed since you explained them: check that their "why" still holds.`,
        );
    }
    // Unchanged code is a note, not a problem: it may be on purpose.
    const problems =
        coverage.nowhere.length + coverage.unexplained.length + stale.length;
    if (problems > 0) {
        lines.push("Fix these with restitution_edit.");
    } else if (coverage.unchanged.length === 0) {
        lines.push("Every changed line is shown by a step.");
    }
    return lines.join("\n");
}
