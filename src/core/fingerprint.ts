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
 * Identity of a step: what the reader reads in it (file, words, connector,
 * examples, docs). Changing any of it brings the step back unviewed and
 * marked as updated. Line numbers are left out: code changed above a step
 * shifts them, and the agent re-anchoring it changes nothing the reader
 * reads. Neither does the code under it changing (a different signal, see
 * `codeDigest`).
 */
export function stepFingerprint(step: Step): string {
    const parts = [step.file ?? "", step.why, step.link ?? "then"];
    // Only when present, so adding these fields changes nothing for others.
    if (step.examples) {
        parts.push(JSON.stringify(step.examples));
    }
    if (step.docs) {
        parts.push(JSON.stringify(step.docs));
    }
    return fnv1a(parts.join("\0"));
}

/** How the agent's note on an update goes in the review's `known` list. */
export function noteKey(note: string): string {
    return `note:${fnv1a(note)}`;
}

/** The fingerprint of every step, goal by goal. */
export function goalFingerprints(restitution: Restitution): string[][] {
    return restitution.goals.map((goal) => goal.steps.map(stepFingerprint));
}

/**
 * What a step's code looks like now: its changed lines, without line numbers
 * or the context around them. Undefined when it shows no change.
 */
export function codeDigest(hunks: Hunk[]): string | undefined {
    const changes = hunks
        .flatMap((hunk) => hunk.lines)
        .filter((line) => line.kind !== "ctx")
        .map((line) => `${line.kind}${line.text}`);
    return changes.length > 0 ? fnv1a(changes.join("\n")) : undefined;
}

/** The code each step shows, right now. */
export function stepHunks(step: Step, diffs: Record<string, FileDiff>): Hunk[] {
    return selectLines(
        step.file ? diffs[step.file] : undefined,
        step.lines ?? [],
    );
}

/**
 * A snapshot of every step's code, keyed by step fingerprint: what the
 * explanations were written against.
 */
export function codeSnapshot(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
): Record<string, string> {
    const snapshot: Record<string, string> = {};
    for (const step of restitution.goals.flatMap((goal) => goal.steps)) {
        const digest = codeDigest(stepHunks(step, diffs));
        if (digest) {
            snapshot[stepFingerprint(step)] = digest;
        }
    }
    return snapshot;
}

/**
 * Whether a step's code changed since its explanation was written. Only when
 * both are known: a step whose changes are gone (committed, say) shows that
 * on its own, and is not "changed".
 */
export function isStale(
    written: string | undefined,
    now: string | undefined,
): boolean {
    return written !== undefined && now !== undefined && written !== now;
}

/** The labels ("2.1") of the steps whose code changed since `snapshot`. */
export function staleLabels(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
    snapshot: Record<string, string>,
): string[] {
    return restitution.goals.flatMap((goal, g) =>
        goal.steps.flatMap((step, s) =>
            isStale(
                snapshot[stepFingerprint(step)],
                codeDigest(stepHunks(step, diffs)),
            )
                ? [`${g + 1}.${s + 1}`]
                : [],
        ),
    );
}
