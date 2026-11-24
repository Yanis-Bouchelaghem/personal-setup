import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff";
import {
    codeDigest,
    codeSnapshot,
    goalFingerprints,
    isStale,
    staleLabels,
    stepFingerprint,
} from "./fingerprint";
import type { Restitution, Step } from "./restitution";

const diffOf = (added: string, start = 10) =>
    Object.fromEntries(
        parseUnifiedDiff(
            `diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -${start},3 +${start},3 @@\n ctx\n-old\n+${added}\n tail\n`,
        ).map((d) => [d.file, d]),
    );

const step: Step = {
    code: [{ file: "a.ts", lines: [[10, 12]] }],
    why: "Do it, so it works.",
};

const restitution: Restitution = {
    version: 1,
    goals: [
        { title: "G", steps: [step, { why: "Then explain.", link: "then" }] },
    ],
};

describe("stepFingerprint", () => {
    it("is stable, and changes with anything the reader reads", () => {
        expect(stepFingerprint(step)).toBe(stepFingerprint({ ...step }));
        const changes: Step[] = [
            { ...step, why: "Do it differently." },
            { ...step, link: "so" },
            { ...step, code: [{ file: "b.ts", lines: [[10, 12]] }] },
            // A second place, even in the same file, is something new to read.
            {
                ...step,
                code: [
                    { file: "a.ts", lines: [[10, 12]] },
                    { file: "a.ts", lines: [[1, 2]] },
                ],
            },
            { ...step, examples: [{ title: "An example", body: "{}" }] },
            { ...step, docs: [{ title: "Docs", url: "https://example.com" }] },
        ];
        for (const changed of changes) {
            expect(stepFingerprint(changed)).not.toBe(stepFingerprint(step));
        }
        // Lines shift when code changes above the step: not a new step.
        expect(
            stepFingerprint({
                ...step,
                code: [{ file: "a.ts", lines: [[20, 22]] }],
            }),
        ).toBe(stepFingerprint(step));
        // "then" is the default, so writing it out changes nothing.
        expect(stepFingerprint({ ...step, link: "then" })).toBe(
            stepFingerprint(step),
        );
    });

    it("is one per step, goal by goal", () => {
        const [first, second] = goalFingerprints(restitution)[0]!;
        expect(first).toBe(stepFingerprint(step));
        expect(second).not.toBe(first);
    });
});

describe("code changes under a step", () => {
    it("digests the changed lines only, not where they are or what surrounds them", () => {
        const hunks = (diffs: ReturnType<typeof diffOf>) =>
            diffs["a.ts"]!.hunks;
        expect(codeDigest(hunks(diffOf("new", 10)))).toBe(
            codeDigest(hunks(diffOf("new", 200))),
        );
        expect(codeDigest(hunks(diffOf("newer")))).not.toBe(
            codeDigest(hunks(diffOf("new"))),
        );
        expect(codeDigest([])).toBeUndefined();
    });

    it("finds the steps whose code changed since the snapshot", () => {
        const written = codeSnapshot(restitution, diffOf("new"));
        expect(Object.keys(written)).toEqual([stepFingerprint(step)]);
        expect(staleLabels(restitution, diffOf("new"), written)).toEqual([]);
        expect(staleLabels(restitution, diffOf("newer"), written)).toEqual([
            "1.1",
        ]);
        // Changes gone (committed): not "changed", the step shows that itself.
        expect(staleLabels(restitution, {}, written)).toEqual([]);
    });

    it("needs both sides to call a step changed", () => {
        expect(isStale("a", "b")).toBe(true);
        expect(isStale("a", "a")).toBe(false);
        expect(isStale(undefined, "b")).toBe(false);
        expect(isStale("a", undefined)).toBe(false);
    });
});
