import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff";
import { goalFingerprints, stepFingerprint } from "./fingerprint";
import type { Restitution, Step } from "./restitution";

const diff = (body: string, start = 10) =>
    parseUnifiedDiff(
        `diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -${start},3 +${start},3 @@\n ${body}\n-old\n+new\n tail\n`,
    )[0]!.hunks;

const step: Step = {
    file: "a.ts",
    lines: [[1, 3]],
    why: "Do it, so it works.",
};

describe("stepFingerprint", () => {
    it("is stable for the same step and the same changes", () => {
        expect(stepFingerprint(step, diff("ctx"))).toBe(
            stepFingerprint(step, diff("ctx")),
        );
    });

    it("ignores line numbers and surrounding context", () => {
        expect(stepFingerprint(step, diff("ctx", 10))).toBe(
            stepFingerprint(step, diff("other context", 200)),
        );
    });

    it("ignores the step's words: rewording is not new code", () => {
        const reworded = {
            ...step,
            why: "Do it differently, so it works.",
            link: "so" as const,
        };
        expect(stepFingerprint(reworded, diff("ctx"))).toBe(
            stepFingerprint(step, diff("ctx")),
        );
    });

    it("tells steps without code apart by their text", () => {
        const a = { why: "Explain the setup." };
        const b = { why: "Explain the teardown." };
        expect(stepFingerprint(a, [])).not.toBe(stepFingerprint(b, []));
    });

    it("changes when the file changes", () => {
        expect(
            stepFingerprint({ ...step, file: "b.ts" }, diff("ctx")),
        ).not.toBe(stepFingerprint(step, diff("ctx")));
    });

    it("changes when the changed code changes", () => {
        const edited = parseUnifiedDiff(
            "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -10,3 +10,3 @@\n ctx\n-old\n+newer\n tail\n",
        )[0]!.hunks;
        expect(stepFingerprint(step, edited)).not.toBe(
            stepFingerprint(step, diff("ctx")),
        );
    });
});

describe("goalFingerprints", () => {
    const restitution: Restitution = {
        version: 1,
        goals: [
            {
                title: "One",
                steps: [
                    step,
                    { file: "a.ts", lines: [[1, 3]], why: "Then more." },
                ],
            },
            { title: "Two", steps: [{ why: "No code here." }] },
        ],
    };
    const diffs = {
        "a.ts": parseUnifiedDiff(
            "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n",
        )[0]!,
    };

    it("answers goal by goal, step by step", () => {
        const prints = goalFingerprints(restitution, diffs);
        expect(prints.map((goal) => goal.length)).toEqual([2, 1]);
    });

    it("is stable, and tells steps with different code apart", () => {
        expect(goalFingerprints(restitution, diffs)).toEqual(
            goalFingerprints(restitution, diffs),
        );
        const [first, second] = goalFingerprints(restitution, diffs)[0]!;
        expect(first).toBe(second); // same file, same hunk: the same code
        expect(goalFingerprints(restitution, {})[1]![0]).not.toBe(first);
    });
});
