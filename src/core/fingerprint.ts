import { type FileDiff, type Hunk, selectLines } from "./diff";
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
 * Identity of a step as the reader saw it: its words, its connector, its file,
 * the lines it changed, its examples and its docs. Anything the agent changes in a step changes its
 * fingerprint, so the step comes back unviewed and marked as updated; a step
 * the agent leaves alone keeps it. Line numbers and context are left out, so
 * an edit elsewhere in the file doesn't count as a change to this step.
 */
export function stepFingerprint(step: Step, hunks: Hunk[]): string {
    const changes = hunks
        .flatMap((hunk) => hunk.lines)
        .filter((line) => line.kind !== "ctx")
        .map((line) => `${line.kind}${line.text}`)
        .join("\n");
    const parts = [step.file ?? "", changes, step.why, step.link ?? "then"];
    // Only when there are examples, so steps without any keep their fingerprint.
    if (step.examples) {
        parts.push(JSON.stringify(step.examples));
    }
    if (step.docs) {
        parts.push(JSON.stringify(step.docs));
    }
    return fnv1a(parts.join("\0"));
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
                selectLines(
                    step.file ? diffs[step.file] : undefined,
                    step.lines ?? [],
                ),
            ),
        ),
    );
}
