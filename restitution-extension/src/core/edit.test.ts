import { describe, expect, it } from "vitest";

import { applyEdits, type Edit, EditSchema, outline } from "./edit";
import type { Restitution } from "./restitution";

const base: Restitution = {
    version: 1,
    goals: [
        {
            title: "First",
            steps: [
                { code: [{ file: "a.ts", lines: [[1, 2]] }], why: "Do a." },
                {
                    code: [{ file: "b.ts", lines: [[3, 4]] }],
                    link: "then",
                    why: "do b.",
                },
            ],
        },
        {
            title: "Second",
            ref: "#2",
            steps: [{ why: "Do c." }],
        },
    ],
};

function whys(result: ReturnType<typeof applyEdits>): string[][] {
    if (!result.ok) {
        throw new Error(result.errors.join("\n"));
    }
    return result.value.goals.map((goal) => goal.steps.map((s) => s.why));
}

describe("applyEdits", () => {
    it("changes only the fields given, and leaves every other step as it was", () => {
        const result = applyEdits(base, [
            { op: "set", step: "1.2", fields: { why: "do b better." } },
        ]);
        expect(whys(result)).toEqual([["Do a.", "do b better."], ["Do c."]]);
        expect(result.ok && result.value.goals[0]?.steps[1]).toEqual({
            code: [{ file: "b.ts", lines: [[3, 4]] }],
            link: "then",
            why: "do b better.",
        });
        expect(result.ok && result.value.goals[0]?.steps[0]).toEqual(
            base.goals[0]?.steps[0],
        );
    });

    it("splits, removes and inserts, with labels from before the edit", () => {
        const result = applyEdits(base, [
            {
                op: "replace",
                step: "1.1",
                steps: [{ why: "Do a1." }, { link: "then", why: "do a2." }],
            },
            // Still "1.2", although 1.1 became two steps.
            { op: "insert", after: "1.2", steps: [{ why: "do b2." }] },
            { op: "replace", step: "2.1", steps: [] },
            { op: "insert", before: "2.1", steps: [{ why: "Do c2." }] },
        ]);
        expect(whys(result)).toEqual([
            ["Do a1.", "do a2.", "do b.", "do b2."],
            ["Do c2."],
        ]);
    });

    it("edits goals: retitle, add, remove", () => {
        const result = applyEdits(base, [
            { op: "setGoal", goal: 1, title: "Renamed" },
            { op: "removeGoal", goal: 2 },
            {
                op: "addGoal",
                after: 0,
                goal: { title: "New", steps: [{ why: "Do n." }] },
            },
        ]);
        expect(
            result.ok && result.value.goals.map((goal) => goal.title),
        ).toEqual(["New", "Renamed"]);
    });

    it("applies nothing when any edit is wrong, and says which", () => {
        expect(
            applyEdits(base, [
                { op: "set", step: "1.1", fields: { why: "fine." } },
                { op: "set", step: "3.1", fields: { why: "no such step." } },
            ]),
        ).toEqual({ ok: false, errors: ["There is no step 3.1."] });
        expect(
            applyEdits(base, [{ op: "replace", step: "2.1", steps: [] }]),
        ).toMatchObject({ ok: false });
    });

    it("rejects a place without lines", () => {
        const result = applyEdits(base, [
            {
                op: "set",
                step: "2.1",
                // @ts-expect-error: what an agent might send
                fields: { code: [{ file: "c.ts" }] },
            },
        ]);
        expect(result.ok).toBe(false);
    });

    it("validates edits as the agent sends them", () => {
        const edit: unknown = { op: "set", step: "two", fields: {} };
        expect(EditSchema.safeParse(edit).success).toBe(false);
        const good: Edit = { op: "removeGoal", goal: 1 };
        expect(EditSchema.safeParse(good).success).toBe(true);
    });
});

describe("outline", () => {
    it("lists every step with its label, connector, file and lines", () => {
        expect(outline(base)).toBe(
            [
                "1. First",
                "  1.1 a.ts:1-2: Do a.",
                "  1.2 [then] b.ts:3-4: do b.",
                "2. Second",
                "  2.1: Do c.",
            ].join("\n"),
        );
    });
});
