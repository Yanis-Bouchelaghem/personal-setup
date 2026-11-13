import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { restitutionDir } from "./store/paths";
import { readTabs, writeRestitution } from "./store/tabs";
import { restitutionFor, testRepo } from "./store/testRepo";
import { submitRestitution } from "./submit";

describe("submitRestitution", () => {
    it("counts another tab's steps as explaining a hunk", async () => {
        const dir = testRepo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        writeFileSync(join(dir, "b.ts"), "x\nY\n");
        await writeRestitution(dir, "other", restitutionFor("b.ts"));

        const text = await submitRestitution(
            dir,
            "mine",
            restitutionFor("a.ts"),
        );
        expect(text).toMatch(/Every changed line is shown by a step/);
    });

    it("resubmitting the same id replaces the tab", async () => {
        const dir = testRepo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        await submitRestitution(dir, "mine", restitutionFor("a.ts", "v1"));
        await submitRestitution(dir, "mine", restitutionFor("a.ts", "v2"));

        const tabs = await readTabs(dir);
        expect(tabs).toHaveLength(1);
        expect(tabs[0]?.label).toBe("v2");
        expect(
            readFileSync(join(restitutionDir(dir), "mine.json"), "utf8"),
        ).toMatch(/v2/);
    });
});
