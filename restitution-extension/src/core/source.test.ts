import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff";
import type { Restitution } from "./restitution";
import {
    describePlace,
    fileRuns,
    pickLines,
    places,
    showsChange,
    sourceHunks,
    splitLines,
    unchangedPlaces,
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
                    code: [{ file: "a.ts", lines: [[1, 2]] }],
                    why: "Change it, so it works.",
                },
                {
                    code: [{ file: "a.ts", lines: [[3, 3]] }],
                    why: "Context only.",
                },
                {
                    code: [{ file: "lib.ts", lines: [[3, 4]] }],
                    why: "Existing code.",
                },
                { link: "which means", why: "No code." },
            ],
        },
    ],
};

describe("unchanged places", () => {
    it("tells changed code from context-only and unchanged files", () => {
        const [changed, context, existing] = places(restitution);
        expect(changed && showsChange(changed, diffs)).toBe(true);
        expect(context && showsChange(context, diffs)).toBe(false);
        expect(existing && showsChange(existing, diffs)).toBe(false);
        expect(unchangedPlaces(restitution, diffs).map(describePlace)).toEqual([
            "a.ts:3",
            "lib.ts:3-4",
        ]);
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

describe("a step's code across files", () => {
    it("groups neighbouring places of one file, each changed or unchanged on its own", () => {
        const runs = fileRuns(
            {
                why: "Follow it across files.",
                code: [
                    { file: "a.ts", lines: [[1, 3]] },
                    { file: "a.ts", lines: [[40, 41]] },
                    { file: "lib.ts", lines: [[3, 4]] },
                    { file: "a.ts", lines: [[2, 2]] },
                ],
            },
            diffs,
            { "lib.ts": { 3: "three", 4: "four" } },
        );
        expect(
            runs.map((run) => [
                run.file,
                run.places.map((place) => [
                    place.unchanged,
                    place.hunks.length,
                    place.selection,
                ]),
            ]),
        ).toEqual([
            [
                "a.ts",
                [
                    // The change selects only its added line.
                    [false, 1, [[2, 2]]],
                    // Lines that are not in the file: nothing to show.
                    [false, 0, [[40, 41]]],
                ],
            ],
            ["lib.ts", [[true, 1, [[3, 4]]]]],
            ["a.ts", [[false, 1, [[2, 2]]]]],
        ]);
    });
});
