import { describe, expect, it } from "vitest";

import { feedbackPrompt } from "./feedback";

describe("feedbackPrompt", () => {
    it("lists what is asked, step by step, in reading order", () => {
        expect(
            feedbackPrompt("review-fixes", "Review fixes", [
                { step: "x", label: "3.10", clarify: true },
                { step: "y", label: "2.2", clarify: true, comment: "Why?" },
                {
                    step: "z",
                    label: "3.2",
                    clarify: false,
                    comment: "Keep it.",
                },
            ]),
        ).toBe(
            [
                'My review of the restitution "Review fixes" (id: review-fixes):',
                '- 2.2: clarify. "Why?"',
                '- 3.2: "Keep it."',
                "- 3.10: clarify",
            ].join("\n"),
        );
    });
});
