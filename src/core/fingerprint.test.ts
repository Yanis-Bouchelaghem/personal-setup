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
