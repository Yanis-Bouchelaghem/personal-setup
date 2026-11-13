import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { ViewState } from "../core/messages";
import { parseRestitution, type Restitution } from "../core/restitution";
import { readDiffs } from "./git";

const run = promisify(execFile);
const DIR = ".restitution";

export function restitutionDir(gitRoot: string): string {
    return join(gitRoot, DIR);
}

function isNotFound(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Read the agent's file and turn it into what the panel shows. */
export async function readViewState(gitRoot: string): Promise<ViewState> {
    let text: string;
    try {
        text = await readFile(
            join(restitutionDir(gitRoot), "working.json"),
            "utf8",
        );
    } catch (error) {
        if (isNotFound(error)) {
            return { status: "empty" };
        }
        throw error;
    }
    const parsed = parseRestitution(text);
    if (!parsed.ok) {
        return { status: "error", errors: parsed.errors };
    }
    const files = parsed.value.goals.flatMap((goal) =>
        goal.steps.flatMap((step) => (step.file ? [step.file] : [])),
    );
    // A git hiccup must not hide the explanations: show them without hunks.
    const diffs = await readDiffs(gitRoot, files).catch(() => ({}));
    return { status: "ok", restitution: parsed.value, diffs };
}

/**
 * Create `.restitution/` and keep it out of `git status` through
 * `info/exclude`, which works in worktrees and never touches .gitignore.
 */
export async function ensureRestitutionDir(gitRoot: string): Promise<void> {
    await mkdir(restitutionDir(gitRoot), { recursive: true });
    const { stdout } = await run("git", [
        "-C",
        gitRoot,
        "rev-parse",
        "--git-path",
        "info/exclude",
    ]);
    const excludeFile = resolve(gitRoot, stdout.trim());
    const entry = `${DIR}/`;
    const current = await readFile(excludeFile, "utf8").catch(() => "");
    if (current.split("\n").includes(entry)) {
        return;
    }
    await mkdir(dirname(excludeFile), { recursive: true });
    const separator = current === "" || current.endsWith("\n") ? "" : "\n";
    await writeFile(excludeFile, `${current}${separator}${entry}\n`);
}

/** Write working.json atomically, so a watcher never reads half a file. */
export async function writeRestitution(
    gitRoot: string,
    restitution: Restitution,
): Promise<void> {
    await ensureRestitutionDir(gitRoot);
    const target = join(restitutionDir(gitRoot), "working.json");
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(restitution, null, 4)}\n`);
    await rename(temporary, target);
}
