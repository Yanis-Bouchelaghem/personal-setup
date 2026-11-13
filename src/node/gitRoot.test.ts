import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findGitRoot } from "./gitRoot";

function tempDir(): string {
    return realpathSync(mkdtempSync(join(tmpdir(), "restitution-")));
}

describe("findGitRoot", () => {
    it("finds the repo from a nested folder", () => {
        const root = tempDir();
        mkdirSync(join(root, ".git"));
        const nested = join(root, "modules", "adapter");
        mkdirSync(nested, { recursive: true });
        expect(findGitRoot(nested)).toBe(root);
    });

    it("treats a .git file (worktree) as a root", () => {
        const root = tempDir();
        writeFileSync(join(root, ".git"), "gitdir: /elsewhere");
        expect(findGitRoot(root)).toBe(root);
    });

    it("returns undefined outside any repo", () => {
        expect(findGitRoot(tempDir())).toBeUndefined();
    });
});
