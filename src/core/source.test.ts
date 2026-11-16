import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff";
import type { Restitution } from "./restitution";
import {
    pickLines,
    showsChange,
    sourceHunks,
    splitLines,
    unchangedSteps,
} from "./source";

const diffs = Object.fromEntries(
    parseUnifiedDiff(
        [
            "diff --git a/a.ts b/a.ts",
            "--- a/a.ts",
            "+++ b/a.ts",
            "@@ -1,2 +1,3 @@",
            " keep",
            "+new",
            " tail",
        ].join("\n"),
    ).map((diff) => [diff.file, diff]),
);

const restitution: Restitution = {
    version: 1,
    goals: [
        {
            title: "Explain",
            steps: [
                {
                    file: "a.ts",
                    lines: [[1, 2]],
                    why: "Change it, so it works.",
                },
                { file: "a.ts", lines: [[3, 3]], why: "Context only." },
                { file: "lib.ts", lines: [[3, 4]], why: "Existing code." },
                { link: "which means", why: "No code." },
            ],
        },
    ],
};

describe("unchanged steps", () => {
    it("tells changed code from context-only and unchanged files", () => {
        const [changed, context, existing] = restitution.goals[0]?.steps ?? [];
        expect(changed && showsChange(changed, diffs)).toBe(true);
        expect(context && showsChange(context, diffs)).toBe(false);
        expect(existing && showsChange(existing, diffs)).toBe(false);
        expect(
            unchangedSteps(restitution, diffs).map((step) => step.why),
        ).toEqual(["Context only.", "Existing code."]);
    });
});

describe("reading existing code", () => {
    it("splits lines without a phantom last line, CRLF included", () => {
        expect(splitLines("a\r\nb\n")).toEqual(["a", "b"]);
        expect(splitLines("a\nb")).toEqual(["a", "b"]);
    });

    it("picks only the lines asked for, within the file", () => {
        expect(
            pickLines(
                ["l1", "l2", "l3", "l4"],
                [
                    [0, 1],
                    [3, 99],
                ],
            ),
        ).toEqual({ 1: "l1", 3: "l3", 4: "l4" });
    });

    it("shows them as context hunks, one per run, in order", () => {
        const hunks = sourceHunks({ 4: "d", 2: "b", 3: "c", 9: "i" }, [
            [2, 4],
            [9, 9],
            [1_000_000, 2_000_000],
        ]);
        expect(
            hunks.map((hunk) => [
                hunk.newStart,
                hunk.lines.map(
                    (line) => `${line.kind}:${line.newNo}:${line.text}`,
                ),
            ]),
        ).toEqual([
            [2, ["ctx:2:b", "ctx:3:c", "ctx:4:d"]],
            [9, ["ctx:9:i"]],
        ]);
        expect(sourceHunks(undefined, [[1, 2]])).toEqual([]);
    });
});
