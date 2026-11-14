import { describe, expect, it } from "vitest";

import { checkCoverage, describeSubmit, uncoveredChanges } from "./coverage";
import { parseUnifiedDiff } from "./diff";
import type { Restitution } from "./restitution";

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
-one
+ONE
 two
@@ -20,2 +20,2 @@
 keep
-old
+new
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -5,1 +5,1 @@
-x
+y
`;

const diffs = Object.fromEntries(
    parseUnifiedDiff(DIFF).map((d) => [d.file, d]),
);

type Range = [number, number];

function restitution(steps: { file?: string; lines?: Range[] }[]) {
    return {
        version: 1,
        goals: [
            {
                title: "Goal",
                steps: steps.map((s) => ({ why: "Do it, so it works.", ...s })),
            },
        ],
    } satisfies Restitution;
}

describe("checkCoverage", () => {
    it("is clean when every changed line is shown", () => {
        const result = checkCoverage(
            restitution([
                {
                    file: "src/a.ts",
                    lines: [
                        [1, 2],
                        [20, 21],
                    ],
                },
                { file: "src/b.ts", lines: [[5, 5]] },
            ]),
            diffs,
        );
        expect(result).toEqual({ missing: [], unexplained: [] });
    });

    it("lists the changed lines no step shows, per file", () => {
        const result = checkCoverage(
            restitution([{ file: "src/a.ts", lines: [[1, 2]] }]),
            diffs,
        );
        expect(result.unexplained).toEqual(["src/a.ts:20-21", "src/b.ts:5"]);
    });

    it("tells a half-shown change from a shown one", () => {
        // Line 1 holds a removal and an addition; showing only line 2 shows neither.
        const result = checkCoverage(
            restitution([
                {
                    file: "src/a.ts",
                    lines: [
                        [2, 2],
                        [20, 21],
                    ],
                },
                { file: "src/b.ts", lines: [[5, 5]] },
            ]),
            diffs,
        );
        expect(result.unexplained).toEqual(["src/a.ts:1"]);
    });

    it("lists steps whose lines hold no change", () => {
        const result = checkCoverage(
            restitution([
                {
                    file: "src/a.ts",
                    lines: [
                        [1, 2],
                        [20, 21],
                    ],
                },
                { file: "src/b.ts", lines: [[5, 5]] },
                { file: "src/gone.ts", lines: [[1, 3]] },
                { file: "src/a.ts", lines: [[100, 110]] },
                { file: "src/a.ts", lines: [[2, 2]] },
            ]),
            diffs,
        );
        expect(result.missing).toEqual([
            "src/gone.ts:1-3",
            "src/a.ts:100-110",
            "src/a.ts:2",
        ]);
    });

    it("counts lines other tabs show, and flags only the current tab's steps", () => {
        const current = restitution([
            {
                file: "src/a.ts",
                lines: [
                    [1, 2],
                    [20, 21],
                ],
            },
        ]);
        const other = restitution([
            { file: "src/b.ts", lines: [[5, 5]] },
            { file: "src/ghost.ts", lines: [[1, 1]] },
        ]);
        const result = checkCoverage(current, diffs, [other]);
        expect(result).toEqual({ missing: [], unexplained: [] });
    });

    it("ignores steps without a file", () => {
        const result = checkCoverage(restitution([{}]), {});
        expect(result).toEqual({ missing: [], unexplained: [] });
    });
});

describe("uncoveredChanges", () => {
    it("lists, file by file, the changed lines no guide shows", () => {
        const shownByOne = restitution([{ file: "src/a.ts", lines: [[1, 2]] }]);
        const shownByAnother = restitution([]);
        const result = uncoveredChanges(diffs, [shownByOne, shownByAnother]);
        expect(result.map((entry) => [entry.file, entry.ranges])).toEqual([
            // A removed line sits with the line before it (20), so that line
            // comes along as context.
            ["src/a.ts", [[20, 21]]],
            ["src/b.ts", [[5, 5]]],
        ]);
        expect(
            result[0]?.hunks.flatMap((hunk) =>
                hunk.lines.map((line) => `${line.kind}:${line.text}`),
            ),
        ).toEqual(["ctx:keep", "del:old", "add:new"]);
    });

    it("is empty when every change is shown, or there is no diff", () => {
        const all = restitution([
            {
                file: "src/a.ts",
                lines: [
                    [1, 2],
                    [20, 21],
                ],
            },
            { file: "src/b.ts", lines: [[5, 5]] },
        ]);
        expect(uncoveredChanges(diffs, [all])).toEqual([]);
        expect(uncoveredChanges({}, [all])).toEqual([]);
    });
});

describe("describeSubmit", () => {
    const r = restitution([{ file: "src/a.ts", lines: [[1, 2]] }]);

    it("points at steps whose code changed since they were explained", () => {
        const clean = { missing: [], unexplained: [] };
        expect(describeSubmit(r, clean, ["1.1"])).toMatch(
            /The code of step 1\.1 changed since you explained it/,
        );
        expect(describeSubmit(r, clean, ["1.1", "2.3"])).toMatch(
            /steps 1\.1, 2\.3 changed since you explained them/,
        );
    });

    it("confirms a clean submission", () => {
        const text = describeSubmit(r, { missing: [], unexplained: [] });
        expect(text).toMatch(/Saved: 1 goals, 1 steps/);
        expect(text).toMatch(/Every changed line is shown by a step/);
    });

    it("asks for a fix when something is off", () => {
        const text = describeSubmit(r, {
            missing: ["src/x.ts:1-2"],
            unexplained: ["src/b.ts:5"],
        });
        expect(text).toMatch(/src\/x\.ts:1-2/);
        expect(text).toMatch(/src\/b\.ts:5/);
        expect(text).toMatch(/Fix these with restitution_edit/);
    });

    it("says when coverage could not be checked", () => {
        expect(describeSubmit(r, undefined)).toMatch(/not checked/);
    });
});
