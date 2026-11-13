import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isRepoRelative, readDiffs } from "./git";

function sh(cwd: string, ...args: string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
}

function repo(): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "restitution-git-")));
    sh(dir, "init", "-q", "-b", "main");
    sh(dir, "config", "user.email", "t@t");
    sh(dir, "config", "user.name", "t");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "one\ntwo\nthree\n");
    sh(dir, "add", ".");
    sh(dir, "commit", "-q", "-m", "init");
    return dir;
}

describe("readDiffs", () => {
    it("reads modified, untracked and unchanged files", async () => {
        const dir = repo();
        writeFileSync(join(dir, "src", "a.ts"), "one\nTWO\nthree\n");
        writeFileSync(join(dir, "src", "b.ts"), "new\n");
        const diffs = await readDiffs(dir, [
            "src/a.ts",
            "src/b.ts",
            "src/c.ts",
        ]);

        expect(diffs["src/a.ts"]?.status).toBe("modified");
        expect(diffs["src/a.ts"]?.hunks[0]?.lines.map((l) => l.kind)).toEqual([
            "ctx",
            "del",
            "add",
            "ctx",
        ]);
        expect(diffs["src/b.ts"]?.status).toBe("added");
        expect(diffs["src/c.ts"]).toBeUndefined();
    });

    it("includes staged changes", async () => {
        const dir = repo();
        writeFileSync(join(dir, "src", "a.ts"), "one\ntwo\nthree\nfour\n");
        sh(dir, "add", ".");
        const diffs = await readDiffs(dir, ["src/a.ts"]);
        expect(diffs["src/a.ts"]?.hunks).toHaveLength(1);
    });

    it("works in a repo without a first commit", async () => {
        const dir = realpathSync(
            mkdtempSync(join(tmpdir(), "restitution-git-")),
        );
        sh(dir, "init", "-q", "-b", "main");
        writeFileSync(join(dir, "x.ts"), "x\n");
        sh(dir, "add", "x.ts");
        const diffs = await readDiffs(dir, ["x.ts"]);
        expect(diffs["x.ts"]?.status).toBe("added");
    });

    it("ignores paths that leave the repo", async () => {
        const dir = repo();
        expect(await readDiffs(dir, ["../escape.ts", "/etc/passwd"])).toEqual(
            {},
        );
    });
});

describe("isRepoRelative", () => {
    it("accepts inner paths and rejects escapes", () => {
        expect(isRepoRelative("src/a.ts")).toBe(true);
        expect(isRepoRelative("./src/a.ts")).toBe(true);
        expect(isRepoRelative("../a.ts")).toBe(false);
        expect(isRepoRelative("src/../../a.ts")).toBe(false);
        expect(isRepoRelative("/abs/a.ts")).toBe(false);
    });
});
