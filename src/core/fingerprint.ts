import { type FileDiff, type Hunk, hunksForRange } from "./diff";
import type { Restitution, Step } from "./restitution";

/** FNV-1a, 32 bit: plenty to tell "same content" from "changed". */
function fnv1a(text: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Identity of what a reader looked at: the file and the lines that changed.
 * The words are only display, so an agent rewording a step doesn't send the
 * reader back to code they already read; line numbers and context are left
 * out too. A step with no code behind it falls back to its text.
 */
export function stepFingerprint(step: Step, hunks: Hunk[]): string {
    const changes = hunks
        .flatMap((hunk) => hunk.lines)
        .filter((line) => line.kind !== "ctx")
        .map((line) => `${line.kind}${line.text}`)
        .join("\n");
    return fnv1a([step.file ?? "", changes || step.why].join("\0"));
}

/** The fingerprint of every step, goal by goal, against the current diffs. */
export function goalFingerprints(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
): string[][] {
    return restitution.goals.map((goal) =>
        goal.steps.map((step) =>
            stepFingerprint(
                step,
                hunksForRange(
                    step.file ? diffs[step.file] : undefined,
                    step.lines,
                ),
            ),
        ),
    );
}
