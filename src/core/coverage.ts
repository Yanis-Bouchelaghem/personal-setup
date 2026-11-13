import {
    type DiffLine,
    type FileDiff,
    type LineRange,
    selectLines,
} from "./diff";
import { type Restitution, tabLabel } from "./restitution";

export type Coverage = {
    /** Steps whose lines hold no change, as "file:lines". */
    missing: string[];
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

/**
 * Compare a restitution's steps with the working-tree diffs, line by line. A
 * changed line counts as shown when any restitution's step shows it (`others`
 * are the other tabs); steps whose lines hold no change are only reported for
 * `restitution`.
 */
export function checkCoverage(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
    others: Restitution[] = [],
): Coverage {
    const shown = new Set<DiffLine>();
    const missing: string[] = [];

    for (const candidate of [restitution, ...others]) {
        for (const step of candidate.goals.flatMap((goal) => goal.steps)) {
            if (!step.file || !step.lines) {
                continue;
            }
            const lines = selectLines(diffs[step.file], step.lines).flatMap(
                (hunk) => hunk.lines,
            );
            lines.forEach((line) => shown.add(line));
            const changed = lines.some((line) => line.kind !== "ctx");
            if (candidate === restitution && !changed) {
                missing.push(`${step.file}:${describeRanges(step.lines)}`);
            }
        }
    }

    const unexplained = Object.values(diffs).flatMap((diff) => {
        const hidden = diff.hunks
            .flatMap((hunk) => hunk.lines)
            .filter((line) => line.kind !== "ctx" && !shown.has(line))
            .map((line) => line.at);
        return hidden.length === 0
            ? []
            : [`${diff.file}:${describeRanges(runsOfPositions(hidden))}`];
    });
    return { missing, unexplained };
}

/** What the agent reads back after submitting. Warnings never block. */
export function describeSubmit(
    restitution: Restitution,
    coverage: Coverage | undefined,
): string {
    const steps = restitution.goals.reduce((n, g) => n + g.steps.length, 0);
    const lines = [
        `Saved: ${restitution.goals.length} goals, ${steps} steps, as the tab "${tabLabel(restitution)}" in the user's Restitution panel.`,
    ];
    if (!coverage) {
        lines.push("Could not read the git diff, so coverage was not checked.");
        return lines.join("\n");
    }
    if (coverage.missing.length > 0) {
        lines.push(
            `Steps whose lines hold no uncommitted change (wrong file, or wrong line numbers): ${coverage.missing.join(", ")}.`,
        );
    }
    if (coverage.unexplained.length > 0) {
        lines.push(
            `Changed lines no step shows: ${coverage.unexplained.join(", ")}. Widen a step's "lines" to include them, or add a step.`,
        );
    }
    if (lines.length > 1) {
        lines.push("Fix these and call restitution_submit again.");
    } else {
        lines.push("Every changed line is shown by a step.");
    }
    return lines.join("\n");
}
