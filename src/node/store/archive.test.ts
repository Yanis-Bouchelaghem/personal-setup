import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { archiveTab, countClosed, readClosedTabs, restoreTab } from "./archive";
import { restitutionDir } from "./paths";
import { setViewed } from "./review";
import { readTabs, writeRestitution } from "./tabs";
import { restitutionFor, testRepo } from "./testRepo";
import { readViewState } from "./viewState";

describe("closing a tab", () => {
    it("moves its file to the archive", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "gone", restitutionFor("a.ts"));
        await archiveTab(dir, "gone");

        expect(await readTabs(dir)).toEqual([]);
        expect(
            existsSync(join(restitutionDir(dir), "archive", "gone.json")),
        ).toBe(true);
    });

    it("rejects ids that could escape the folder", async () => {
        await expect(archiveTab(testRepo(), "a/b")).rejects.toThrow();
    });

    it("lists closed tabs, most recently closed first, and counts them", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "one", restitutionFor("a.ts", "First"));
        await writeRestitution(dir, "two", restitutionFor("b.ts", "Second"));
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

    it("has nothing to list before anything was closed", async () => {
        const dir = testRepo();
        expect(await readClosedTabs(dir)).toEqual([]);
        expect(await countClosed(dir)).toBe(0);
    });
});

describe("reopening a tab", () => {
    it("restores it under its own id", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "back", restitutionFor("a.ts"));
        await archiveTab(dir, "back");

        expect(await restoreTab(dir, "back")).toBe("back");
        expect((await readTabs(dir)).map((tab) => tab.id)).toEqual(["back"]);
        expect(await countClosed(dir)).toBe(0);
    });

    it("does not overwrite a tab the agent wrote after the close", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "same", restitutionFor("a.ts", "Old"));
        await archiveTab(dir, "same");
        await writeRestitution(dir, "same", restitutionFor("b.ts", "New"));

        expect(await restoreTab(dir, "same")).toBe("same-2");
        const labels = (await readTabs(dir)).map((tab) => tab.label).toSorted();
        expect(labels).toEqual(["New", "Old"]);
    });

    it("takes the Viewed state along, in and out of the archive", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
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
});
