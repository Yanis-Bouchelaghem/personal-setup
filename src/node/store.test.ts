import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    utimesSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Restitution } from "../core/restitution";
import {
    archiveTab,
    countClosed,
    isTabId,
    newTabId,
    readClosedTabs,
    readTabs,
    readViewState,
    restitutionDir,
    restoreTab,
    setViewed,
    writeRestitution,
} from "./store";
import { submitRestitution } from "./submit";

function repo(): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "restitution-store-")));
    const sh = (...args: string[]) =>
        execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    sh("init", "-q", "-b", "main");
    sh("config", "user.email", "t@t");
    sh("config", "user.name", "t");
    writeFileSync(join(dir, "a.ts"), "one\ntwo\n");
    writeFileSync(join(dir, "b.ts"), "x\ny\n");
    sh("add", ".");
    sh("commit", "-q", "-m", "init");
    return dir;
}

const restitution = (file: string, label?: string): Restitution => ({
    version: 1,
    label,
    goals: [
        {
            title: `Change ${file}`,
            steps: [{ file, why: "Do it, so it works." }],
        },
    ],
});

describe("tabs", () => {
    it("writes one file per restitution and lists them newest first", async () => {
        const dir = repo();
        await writeRestitution(dir, "first", restitution("a.ts", "First"));
        await writeRestitution(dir, "second", restitution("b.ts"));
        utimesSync(join(restitutionDir(dir), "first.json"), 1000, 1000);

        const tabs = await readTabs(dir);
        expect(tabs.map((tab) => tab.id)).toEqual(["second", "first"]);
        expect(tabs.map((tab) => tab.label)).toEqual(["Change b.ts", "First"]);
    });

    it("ignores review sidecars, temporary files, dotfiles and the archive", async () => {
        const dir = repo();
        await writeRestitution(dir, "real", restitution("a.ts"));
        const folder = restitutionDir(dir);
        writeFileSync(join(folder, "real.review.json"), "{}");
        writeFileSync(join(folder, "real.json.123.tmp"), "{");
        writeFileSync(join(folder, ".hidden.json"), "{}");
        mkdirSync(join(folder, "archive"));
        writeFileSync(join(folder, "archive", "old.json"), "{}");

        expect((await readTabs(dir)).map((tab) => tab.id)).toEqual(["real"]);
    });

    it("keeps a broken file as its own error tab", async () => {
        const dir = repo();
        await writeRestitution(dir, "good", restitution("a.ts"));
        writeFileSync(join(restitutionDir(dir), "bad.json"), "{ nope");

        const tabs = await readTabs(dir);
        expect(tabs.find((tab) => tab.id === "bad")?.kind).toBe("error");
        expect(tabs.find((tab) => tab.id === "good")?.kind).toBe("ok");
    });

    it("closing a tab archives its file", async () => {
        const dir = repo();
        await writeRestitution(dir, "gone", restitution("a.ts"));
        await archiveTab(dir, "gone");

        expect(await readTabs(dir)).toEqual([]);
        expect(
            existsSync(join(restitutionDir(dir), "archive", "gone.json")),
        ).toBe(true);
    });

    it("rejects ids that could escape the folder", async () => {
        const dir = repo();
        await expect(
            writeRestitution(dir, "../evil", restitution("a.ts")),
        ).rejects.toThrow();
        await expect(archiveTab(dir, "a/b")).rejects.toThrow();
        expect(isTabId("ok-id-1")).toBe(true);
        expect(isTabId(".hidden")).toBe(false);
        expect(isTabId(newTabId())).toBe(true);
    });

    it("reports an empty folder as empty", async () => {
        expect(await readViewState(repo())).toEqual({
            status: "empty",
            closed: 0,
        });
    });

    it("loads the diffs every tab points at, once", async () => {
        const dir = repo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        writeFileSync(join(dir, "b.ts"), "x\nY\n");
        await writeRestitution(dir, "t1", restitution("a.ts"));
        await writeRestitution(dir, "t2", restitution("b.ts"));

        const state = await readViewState(dir);
        expect(state.status).toBe("ok");
        expect(
            state.status === "ok" && Object.keys(state.diffs).toSorted(),
        ).toEqual(["a.ts", "b.ts"]);
    });
});

describe("submitRestitution", () => {
    it("counts another tab's steps as explaining a hunk", async () => {
        const dir = repo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        writeFileSync(join(dir, "b.ts"), "x\nY\n");
        await writeRestitution(dir, "other", restitution("b.ts"));

        const text = await submitRestitution(dir, "mine", restitution("a.ts"));
        expect(text).toMatch(/Every uncommitted change is explained/);
    });

    it("resubmitting the same id replaces the tab", async () => {
        const dir = repo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        await submitRestitution(dir, "mine", restitution("a.ts", "v1"));
        await submitRestitution(dir, "mine", restitution("a.ts", "v2"));

        const tabs = await readTabs(dir);
        expect(tabs).toHaveLength(1);
        expect(tabs[0]?.label).toBe("v2");
        expect(
            readFileSync(join(restitutionDir(dir), "mine.json"), "utf8"),
        ).toMatch(/v2/);
    });
});

describe("closed tabs", () => {
    it("lists closed tabs, most recently closed first, and counts them", async () => {
        const dir = repo();
        await writeRestitution(dir, "one", restitution("a.ts", "First"));
        await writeRestitution(dir, "two", restitution("b.ts", "Second"));
        await archiveTab(dir, "one");
        await new Promise((resolve) => setTimeout(resolve, 20));
        await archiveTab(dir, "two");

        expect((await readClosedTabs(dir)).map((tab) => tab.label)).toEqual([
            "Second",
            "First",
        ]);
        expect(await countClosed(dir)).toBe(2);
        expect(await readViewState(dir)).toEqual({
            status: "empty",
            closed: 2,
        });
    });

    it("restores a tab under its own id", async () => {
        const dir = repo();
        await writeRestitution(dir, "back", restitution("a.ts"));
        await archiveTab(dir, "back");

        expect(await restoreTab(dir, "back")).toBe("back");
        expect((await readTabs(dir)).map((tab) => tab.id)).toEqual(["back"]);
        expect(await countClosed(dir)).toBe(0);
    });

    it("does not overwrite a tab the agent wrote after the close", async () => {
        const dir = repo();
        await writeRestitution(dir, "same", restitution("a.ts", "Old"));
        await archiveTab(dir, "same");
        await writeRestitution(dir, "same", restitution("b.ts", "New"));

        expect(await restoreTab(dir, "same")).toBe("same-2");
        const labels = (await readTabs(dir)).map((tab) => tab.label).toSorted();
        expect(labels).toEqual(["New", "Old"]);
    });

    it("has nothing to list before anything was closed", async () => {
        const dir = repo();
        expect(await readClosedTabs(dir)).toEqual([]);
        expect(await countClosed(dir)).toBe(0);
    });
});

describe("review sidecar", () => {
    it("remembers Viewed per tab, and is not itself a tab", async () => {
        const dir = repo();
        await writeRestitution(dir, "t1", restitution("a.ts"));
        await setViewed(dir, "t1", "fp-1", true);
        await setViewed(dir, "t1", "fp-2", true);
        await setViewed(dir, "t1", "fp-1", false);

        const tabs = await readTabs(dir);
        expect(tabs).toHaveLength(1);
        expect(tabs[0]?.kind === "ok" && tabs[0].viewed).toEqual(["fp-2"]);
    });

    it("shows nothing viewed when there is no sidecar", async () => {
        const dir = repo();
        await writeRestitution(dir, "t1", restitution("a.ts"));
        const [tab] = await readTabs(dir);
        expect(tab?.kind === "ok" && tab.viewed).toEqual([]);
    });

    it("follows the tab into the archive and back", async () => {
        const dir = repo();
        await writeRestitution(dir, "t1", restitution("a.ts"));
        await setViewed(dir, "t1", "fp-1", true);
        await archiveTab(dir, "t1");
        expect(existsSync(join(restitutionDir(dir), "t1.review.json"))).toBe(
            false,
        );

        const id = await restoreTab(dir, "t1");
        const [tab] = await readTabs(dir);
        expect(tab?.id).toBe(id);
        expect(tab?.kind === "ok" && tab.viewed).toEqual(["fp-1"]);
    });

    it("rejects ids that could escape the folder", async () => {
        await expect(setViewed(repo(), "../x", "fp", true)).rejects.toThrow();
    });
});
