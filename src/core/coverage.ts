import { type FileDiff, hunksForRange } from "./diff";
import type { Restitution } from "./restitution";

export type Coverage = {
    /** Steps that point at code with no uncommitted change. */
    missing: string[];
    /** Changed hunks no step explains, as "file:line". */
    unexplained: string[];
};

function describeAnchor(file: string, lines?: readonly [number, number]) {
    return lines ? `${file}:${lines[0]}-${lines[1]}` : file;
}

/** Compare the steps with the working-tree diffs they should explain. */
export function checkCoverage(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
): Coverage {
    const covered = new Set<unknown>();
    const missing: string[] = [];

    for (const goal of restitution.goals) {
        for (const step of goal.steps) {
            if (!step.file) {
                continue;
            }
            const hunks = hunksForRange(diffs[step.file], step.lines);
            hunks.forEach((hunk) => covered.add(hunk));
            if (hunks.length === 0) {
                missing.push(describeAnchor(step.file, step.lines));
            }
        }
    }

    const unexplained = Object.values(diffs).flatMap((diff) =>
        diff.hunks
            .filter((hunk) => !covered.has(hunk))
            .map((hunk) => `${diff.file}:${hunk.newStart}`),
    );
    return { missing, unexplained };
}

/** What the agent reads back after submitting. Warnings never block. */
export function describeSubmit(
    restitution: Restitution,
    coverage: Coverage | undefined,
): string {
    const steps = restitution.goals.reduce((n, g) => n + g.steps.length, 0);
    const lines = [
        `Saved: ${restitution.goals.length} goals, ${steps} steps. The user reads it in the Restitution panel.`,
    ];
    if (!coverage) {
        lines.push("Could not read the git diff, so coverage was not checked.");
        return lines.join("\n");
    }
    if (coverage.missing.length > 0) {
        lines.push(
            `Steps pointing at code with no uncommitted change (wrong path, wrong lines, or already committed): ${coverage.missing.join(", ")}.`,
        );
    }
    if (coverage.unexplained.length > 0) {
        lines.push(
            `Changed code no step explains: ${coverage.unexplained.join(", ")}. Add a step for each, or widen a step's "lines" or drop them.`,
        );
    }
    if (lines.length > 1) {
        lines.push("Fix these and call restitution_submit again.");
    } else {
        lines.push("Every uncommitted change is explained.");
    }
    return lines.join("\n");
}
