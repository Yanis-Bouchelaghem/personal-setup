import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
    codeDigest,
    isStale,
    stepFingerprint,
    stepHunks,
} from "../../core/fingerprint";
import { readCodeSnapshot } from "./code";
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

    it("records a baseline for steps it has never seen, so later edits show", async () => {
        const dir = testRepo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        await writeRestitution(dir, "t", restitutionFor("a.ts"));
        const step = restitutionFor("a.ts").goals[0]!.steps[0]!;
        const print = stepFingerprint(step);

        const first = await readViewState(dir);
        const baseline =
            first.status === "ok" && first.tabs[0]?.kind === "ok"
                ? first.tabs[0].code[print]
                : undefined;
        expect(baseline).toBeDefined();
        expect(await readCodeSnapshot(dir, "t")).toEqual({ [print]: baseline });

        // A hand edit under the step: the baseline stays, the code differs.
        writeFileSync(join(dir, "a.ts"), "ONE!\ntwo\n");
        const second = await readViewState(dir);
        if (second.status !== "ok" || second.tabs[0]?.kind !== "ok") {
            throw new Error("expected a tab");
        }
        expect(second.tabs[0].code[print]).toBe(baseline);
        const now = codeDigest(stepHunks(step, second.diffs));
        expect(isStale(baseline, now)).toBe(true);
    });
});
