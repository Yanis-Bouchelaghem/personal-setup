import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeRestitution } from "./tabs";
import { restitutionFor, testRepo } from "./testRepo";
import { readViewState } from "./viewState";

describe("readViewState", () => {
    it("reports a repo with no restitutions as empty", async () => {
        expect(await readViewState(testRepo())).toEqual({
            status: "empty",
            closed: 0,
        });
    });

    it("loads the diffs every tab points at, once", async () => {
        const dir = testRepo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        writeFileSync(join(dir, "b.ts"), "x\nY\n");
        await writeRestitution(dir, "t1", restitutionFor("a.ts"));
        await writeRestitution(dir, "t2", restitutionFor("b.ts"));

        const state = await readViewState(dir);
        expect(state.status).toBe("ok");
        expect(
            state.status === "ok" && Object.keys(state.diffs).toSorted(),
        ).toEqual(["a.ts", "b.ts"]);
    });
});
