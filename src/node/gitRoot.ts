import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Walk up from `startDir` to the folder holding `.git`.
 * `.git` is a file in worktrees, so only its existence is checked.
 */
export function findGitRoot(startDir: string): string | undefined {
    let dir = startDir;
    for (;;) {
        if (existsSync(join(dir, ".git"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}
