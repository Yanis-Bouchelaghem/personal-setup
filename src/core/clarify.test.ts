import { describe, expect, it } from "vitest";

import { clarifyPrompt } from "./clarify";

const base = { tabId: "review-fixes", label: "Review fixes", stepLabel: "3.1" };

describe("clarifyPrompt", () => {
    const prompt = clarifyPrompt({
        ...base,
        step: {
            file: "src/marketplace/schema.ts",
            lines: [
                [2, 19],
                [21, 43],
            ],
            why: "Parse each plugin on its own, so one bad entry can't fail the catalog.",
        },
    });

    it("names the step, its tab and where its file is", () => {
        expect(prompt).toContain('step 3.1 of the restitution "Review fixes"');
        expect(prompt).toContain(".restitution/review-fixes.json");
    });

    it("says which code the step shows and what it says", () => {
        expect(prompt).toContain(
            "src/marketplace/schema.ts, lines 2-19, 21-43",
        );
        expect(prompt).toContain("Parse each plugin on its own");
    });

    it("asks for smaller steps and an update of the same tab", () => {
        expect(prompt).toContain("several smaller steps");
        expect(prompt).toContain('"id": "review-fixes"');
        expect(prompt).toContain("Clarifying a step");
    });

    it("handles a step with no code and single-line ranges", () => {
        expect(
            clarifyPrompt({ ...base, step: { why: "Explain the setup." } }),
        ).toContain("(no code)");
        expect(
            clarifyPrompt({
                ...base,
                step: { file: "a.ts", lines: [[7, 7]], why: "Do it." },
            }),
        ).toContain("a.ts, lines 7)");
    });
});
