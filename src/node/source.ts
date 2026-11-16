import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import type { FileDiff } from "../core/diff";
import type { Restitution } from "../core/restitution";
import {
    type AnchoredStep,
    pickLines,
    type SourceLines,
    splitLines,
    unchangedSteps,
} from "../core/source";

/** Beyond this a file is not code anyone reads in a side panel. */
const MAX_BYTES = 2_000_000;

/**
 * A file's lines as it is now, or undefined when it can't be read. Only
 * inside the repository: the path comes from the agent's file.
 */
async function readLines(
    gitRoot: string,
    file: string,
): Promise<string[] | undefined> {
    const root = resolve(gitRoot);
    const path = resolve(root, file);
    if (!path.startsWith(root + sep)) {
        return undefined;
    }
    try {
        const text = await readFile(path, "utf8");
        return text.length > MAX_BYTES ? undefined : splitLines(text);
    } catch {
        return undefined;
    }
}

/** Each file once, with the steps that point at it. */
function byFile(steps: AnchoredStep[]): Map<string, AnchoredStep[]> {
    const files = new Map<string, AnchoredStep[]>();
    for (const step of steps) {
        files.set(step.file, [...(files.get(step.file) ?? []), step]);
    }
    return files;
}

/**
 * The unchanged code steps point at, file by file: only the lines they ask
 * for, so the panel can show existing code next to the changes.
 */
export async function readSources(
    gitRoot: string,
    restitutions: readonly Restitution[],
    diffs: Record<string, FileDiff>,
): Promise<Record<string, SourceLines>> {
    const files = byFile(
        restitutions.flatMap((restitution) =>
            unchangedSteps(restitution, diffs),
        ),
    );
    const entries = await Promise.all(
        [...files].map(async ([file, steps]) => {
            const lines = await readLines(gitRoot, file);
            return lines
                ? [
                      [
                          file,
                          pickLines(
                              lines,
                              steps.flatMap((step) => step.lines),
                          ),
                      ] as const,
                  ]
                : [];
        }),
    );
    return Object.fromEntries(entries.flat());
}

/**
 * How many lines each file of the unchanged steps has, to tell existing code
 * from a wrong anchor. A file that can't be read is left out.
 */
export async function unchangedLineCounts(
    gitRoot: string,
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
): Promise<Record<string, number>> {
    const files = [...byFile(unchangedSteps(restitution, diffs)).keys()];
    const entries = await Promise.all(
        files.map(async (file) => {
            const lines = await readLines(gitRoot, file);
            return lines ? [[file, lines.length] as const] : [];
        }),
    );
    return Object.fromEntries(entries.flat());
}
