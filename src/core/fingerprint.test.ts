import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff";
import { stepFingerprint } from "./fingerprint";
import type { Step } from "./restitution";

const diff = (body: string, start = 10) =>
    parseUnifiedDiff(
        `diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -${start},3 +${start},3 @@\n ${body}\n-old\n+new\n tail\n`,
    )[0]!.hunks;

const step: Step = { file: "a.ts", why: "Do it, so it works." };

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

    it("changes when the step's words change", () => {
        const reworded = { ...step, why: "Do it differently, so it works." };
        expect(stepFingerprint(reworded, diff("ctx"))).not.toBe(
            stepFingerprint(step, diff("ctx")),
        );
        const because = { ...step, because: "Needs step 1." };
        expect(stepFingerprint(because, diff("ctx"))).not.toBe(
            stepFingerprint(step, diff("ctx")),
        );
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
