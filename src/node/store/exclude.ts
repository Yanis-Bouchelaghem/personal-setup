import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { EXCLUDE_ENTRY, restitutionDir } from "./paths";

const run = promisify(execFile);

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
    const current = await readFile(excludeFile, "utf8").catch(() => "");
    if (current.split("\n").includes(EXCLUDE_ENTRY)) {
        return;
    }
    await mkdir(dirname(excludeFile), { recursive: true });
    const separator = current === "" || current.endsWith("\n") ? "" : "\n";
    await writeFile(excludeFile, `${current}${separator}${EXCLUDE_ENTRY}\n`);
}
