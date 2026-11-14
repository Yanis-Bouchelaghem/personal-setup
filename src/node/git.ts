import { execFile } from "node:child_process";
import { isAbsolute, normalize } from "node:path";
import { promisify } from "node:util";

import { type FileDiff, parseUnifiedDiff } from "../core/diff";

const run = promisify(execFile);
const MAX_OUTPUT = 32 * 1024 * 1024;
/** `git hash-object -t tree /dev/null`: the base for a repo with no commit. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** A restitution path must stay inside the repo. */
export function isRepoRelative(file: string): boolean {
    return !isAbsolute(file) && !normalize(file).startsWith("..");
}

/** `differs`: accept exit code 1, which `git diff --no-index` uses for "files differ". */
async function git(
    root: string,
    args: string[],
    { differs = false } = {},
): Promise<string> {
    try {
        const { stdout } = await run("git", ["-C", root, ...args], {
            maxBuffer: MAX_OUTPUT,
        });
        return stdout;
    } catch (error) {
        const exitedOne =
            error instanceof Error && "code" in error && error.code === 1;
        if (differs && exitedOne && "stdout" in error) {
            return String(error.stdout);
        }
        throw error;
    }
}

async function baseRevision(root: string): Promise<string> {
    try {
        await git(root, ["rev-parse", "--verify", "--quiet", "HEAD"]);
        return "HEAD";
    } catch {
        return EMPTY_TREE;
    }
}

/**
 * Working-tree diffs (staged and unstaged, against HEAD) for some files,
 * untracked ones included as fully added. Keyed by repo-relative path.
 */
export async function readDiffs(
    root: string,
    files: string[],
): Promise<Record<string, FileDiff>> {
    const paths = [...new Set(files)].filter(isRepoRelative);
    if (paths.length === 0) {
        return {};
    }
    const base = await baseRevision(root);
    const tracked = parseUnifiedDiff(
        await git(root, ["diff", "--no-color", "-U3", base, "--", ...paths]),
    );
    const untrackedNames = (
        await git(root, [
            "ls-files",
            "--others",
            "--exclude-standard",
            "--",
            ...paths,
        ])
    )
        .split("\n")
        .filter(Boolean);
    const untracked = await Promise.all(
        untrackedNames.map(async (name) =>
            parseUnifiedDiff(
                await git(
                    root,
                    [
                        "diff",
                        "--no-color",
                        "--no-index",
                        "-U3",
                        "--",
                        "/dev/null",
                        name,
                    ],
                    { differs: true },
                ),
            ),
        ),
    );
    return Object.fromEntries(
        [...tracked, ...untracked.flat()].map((diff) => [diff.file, diff]),
    );
}

/** Every uncommitted file: changed against HEAD, staged, or untracked. */
export async function listChangedFiles(root: string): Promise<string[]> {
    const base = await baseRevision(root);
    const [changed, untracked] = await Promise.all([
        git(root, ["diff", "--name-only", "-z", base]),
        git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    ]);
    return [...changed.split("\0"), ...untracked.split("\0")].filter(
        (name) => name !== "" && !name.startsWith(".restitution/"),
    );
}

/** Working-tree diffs of everything uncommitted. */
export async function readAllDiffs(
    root: string,
): Promise<Record<string, FileDiff>> {
    return readDiffs(root, await listChangedFiles(root));
}

/** Start a git repository in `folder` (`git init`). */
export async function initRepo(folder: string): Promise<void> {
    await run("git", ["-C", folder, "init"]);
}
