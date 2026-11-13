import { describe, expect, it } from "vitest";

import { checkCoverage, describeSubmit } from "./coverage";
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

function restitution(steps: { file?: string; lines?: [number, number] }[]) {
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
    it("is clean when every hunk is explained", () => {
        const result = checkCoverage(
            restitution([{ file: "src/a.ts" }, { file: "src/b.ts" }]),
            diffs,
        );
        expect(result).toEqual({ missing: [], unexplained: [] });
    });

    it("lists hunks no step explains", () => {
        const result = checkCoverage(
            restitution([{ file: "src/a.ts", lines: [1, 3] }]),
            diffs,
        );
        expect(result.unexplained).toEqual(["src/a.ts:20", "src/b.ts:5"]);
    });

    it("lists steps that point at unchanged code", () => {
        const result = checkCoverage(
            restitution([
                { file: "src/a.ts" },
                { file: "src/b.ts" },
                { file: "src/gone.ts" },
                { file: "src/a.ts", lines: [100, 110] },
            ]),
            diffs,
        );
        expect(result.missing).toEqual(["src/gone.ts", "src/a.ts:100-110"]);
    });

    it("ignores steps without a file", () => {
        const result = checkCoverage(restitution([{}]), {});
        expect(result).toEqual({ missing: [], unexplained: [] });
    });
});

describe("describeSubmit", () => {
    const r = restitution([{ file: "src/a.ts" }]);

    it("confirms a clean submission", () => {
        const text = describeSubmit(r, { missing: [], unexplained: [] });
        expect(text).toMatch(/Saved: 1 goals, 1 steps/);
        expect(text).toMatch(/Every uncommitted change is explained/);
    });

    it("asks for a fix when something is off", () => {
        const text = describeSubmit(r, {
            missing: ["src/x.ts"],
            unexplained: ["src/b.ts:5"],
        });
        expect(text).toMatch(/src\/x\.ts/);
        expect(text).toMatch(/src\/b\.ts:5/);
        expect(text).toMatch(/call restitution_submit again/);
    });

    it("says when coverage could not be checked", () => {
        expect(describeSubmit(r, undefined)).toMatch(/not checked/);
    });
});
