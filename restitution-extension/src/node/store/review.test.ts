import { utimesSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { tabFile } from "./paths";
import { readReview, updateReview } from "./review";
import { readTabs, writeRestitution } from "./tabs";
import { restitutionFor, testRepo } from "./testRepo";

describe("review file", () => {
    it("remembers Viewed per tab, and is not itself a tab", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
        await updateReview(dir, "t1", { type: "viewed", step: "a", on: true });
        await updateReview(dir, "t1", { type: "viewed", step: "b", on: true });
        await updateReview(dir, "t1", { type: "viewed", step: "a", on: false });

        const tabs = await readTabs(dir);
        expect(tabs).toHaveLength(1);
        expect(tabs[0]?.kind === "ok" && tabs[0].viewed).toEqual(["b"]);
        expect(tabs[0]?.kind === "ok" && tabs[0].known).toEqual(["a", "b"]);
    });

    it("shows an empty review when there is no file", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
        const [tab] = await readTabs(dir);
        expect(tab).toMatchObject({ viewed: [], requests: [] });
        expect(tab?.kind === "ok" && tab.known).toBeUndefined();
    });

    it("keeps requests until the agent rewrites the tab after they were sent", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
        await updateReview(dir, "t1", {
            type: "request",
            step: "fp",
            label: "1.1",
            clarify: true,
        });
        utimesSync(tabFile(dir, "t1"), 1, 1);
        await updateReview(dir, "t1", { type: "sent", at: 2000 });

        // Sent, not yet answered: still open.
        let [tab] = await readTabs(dir);
        expect(tab?.kind === "ok" && tab.requests).toHaveLength(1);

        // The agent rewrites the tab: the request is answered.
        await writeRestitution(dir, "t1", restitutionFor("a.ts", "v2"));
        [tab] = await readTabs(dir);
        expect(tab?.kind === "ok" && tab.requests).toEqual([]);
        // ...but it is only hidden, the file keeps the record.
        expect((await readReview(dir, "t1")).requests).toHaveLength(1);
    });

    it("rejects ids that could escape the folder", async () => {
        await expect(
            updateReview(testRepo(), "../x", { type: "reset" }),
        ).rejects.toThrow();
    });
});
