import { describe, expect, it } from "vitest";

import { setViewed } from "./review";
import { readTabs, writeRestitution } from "./tabs";
import { restitutionFor, testRepo } from "./testRepo";

describe("review file", () => {
    it("remembers Viewed per tab, and is not itself a tab", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
        await setViewed(dir, "t1", "fp-1", true);
        await setViewed(dir, "t1", "fp-2", true);
        await setViewed(dir, "t1", "fp-1", false);

        const tabs = await readTabs(dir);
        expect(tabs).toHaveLength(1);
        expect(tabs[0]?.kind === "ok" && tabs[0].viewed).toEqual(["fp-2"]);
    });

    it("shows nothing viewed when there is no file", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
        const [tab] = await readTabs(dir);
        expect(tab?.kind === "ok" && tab.viewed).toEqual([]);
    });

    it("rejects ids that could escape the folder", async () => {
        await expect(
            setViewed(testRepo(), "../x", "fp", true),
        ).rejects.toThrow();
    });
});
