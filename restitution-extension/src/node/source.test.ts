import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkCoverage } from "../core/coverage";
import type { Restitution } from "../core/restitution";
import { readAllDiffs } from "./git";
import { readSources, unchangedLineCounts } from "./source";
import { testRepo } from "./store/testRepo";

const explain = (file: string, lines: [number, number][]): Restitution => ({
    version: 1,
    goals: [{ title: "Explain", steps: [{ file, lines, why: "Read it." }] }],
});

describe("existing code", () => {
    it("reads the lines unchanged steps ask for, never outside the repo", async () => {
        const dir = testRepo();
        writeFileSync(join(dir, "a.ts"), "ONE\ntwo\n");
        const diffs = await readAllDiffs(dir);
        const sources = await readSources(
            dir,
            [
                explain("b.ts", [[2, 5]]),
                explain("a.ts", [[1, 1]]),
                explain("../outside.ts", [[1, 1]]),
                explain("gone.ts", [[1, 1]]),
            ],
            diffs,
        );
        // a.ts:1 is a change, so it comes from the diff, not from here.
        expect(sources).toEqual({ "b.ts": { 2: "y" } });
    });

    it("tells the agent existing code from lines that don't exist", async () => {
        const dir = testRepo();
        const diffs = await readAllDiffs(dir);
        const restitution: Restitution = {
            version: 1,
            goals: [
                {
                    title: "Explain",
                    steps: [
                        { file: "b.ts", lines: [[1, 2]], why: "Read it." },
                        { file: "b.ts", lines: [[2, 9]], why: "Too far." },
                        { file: "gone.ts", lines: [[1, 1]], why: "No file." },
                    ],
                },
            ],
        };
        const counts = await unchangedLineCounts(dir, restitution, diffs);
        const coverage = checkCoverage(restitution, diffs, [], counts);
        expect(coverage.unchanged).toEqual(["b.ts:1-2"]);
        expect(coverage.nowhere).toEqual(["b.ts:2-9", "gone.ts:1"]);
    });
});
