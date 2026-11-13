import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Restitution } from "../../core/restitution";

/** A throwaway git repo with a commit holding a.ts and b.ts. For tests. */
export function testRepo(): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "restitution-store-")));
    const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@t");
    git("config", "user.name", "t");
    writeFileSync(join(dir, "a.ts"), "one\ntwo\n");
    writeFileSync(join(dir, "b.ts"), "x\ny\n");
    git("add", ".");
    git("commit", "-q", "-m", "init");
    return dir;
}

/** The smallest valid restitution: one goal, one step on `file`. */
export const restitutionFor = (file: string, label?: string): Restitution => ({
    version: 1,
    label,
    goals: [
        {
            title: `Change ${file}`,
            steps: [{ file, why: "Do it, so it works." }],
        },
    ],
});
