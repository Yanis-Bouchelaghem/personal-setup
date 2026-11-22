import { describe, expect, it } from "vitest";

import {
    type Answer,
    answersOn,
    isAnswered,
    parseAnswers,
    pinAnswers,
    serializeAnswers,
} from "./answers";
import { stepFingerprint } from "./fingerprint";
import type { Restitution } from "./restitution";
import { applyReviewAction, EMPTY_REVIEW } from "./review";

const answer = (over: Partial<Answer>): Answer => ({
    id: "a1",
    step: "fp1",
    label: "1.1",
    comment: "Why?",
    answer: "Because.",
    at: 100,
    ...over,
});

describe("isAnswered", () => {
    const request = {
        step: "fp1",
        label: "1.1",
        clarify: false,
        comment: "Why  this?",
        sentAt: 50,
    };

    it("matches by step, or by the same words when the step changed", () => {
        expect(isAnswered(request, [answer({})])).toBe(true);
        expect(
            isAnswered(request, [
                answer({ step: "other", comment: "Why this?" }),
            ]),
        ).toBe(true);
        expect(isAnswered(request, [answer({ step: "other" })])).toBe(false);
    });

    it("needs the comment sent, and the answer after it", () => {
        expect(
            isAnswered({ ...request, sentAt: undefined }, [answer({})]),
        ).toBe(false);
        expect(isAnswered(request, [answer({ at: 10 })])).toBe(false);
        expect(
            isAnswered({ ...request, comment: undefined }, [answer({})]),
        ).toBe(false);
    });
});

describe("answersOn", () => {
    it("shows an answer on its step, or by label once that step is gone", () => {
        const answers = [
            answer({ id: "same" }),
            answer({ id: "moved", step: "gone", label: "2.1" }),
            answer({ id: "elsewhere", step: "fp9", label: "2.1" }),
        ];
        const all = new Set(["fp1", "fp2", "fp9"]);
        expect(answersOn(answers, "fp1", "1.1", all).map((a) => a.id)).toEqual([
            "same",
        ]);
        expect(answersOn(answers, "fp2", "2.1", all).map((a) => a.id)).toEqual([
            "moved",
        ]);
    });
});

describe("pinAnswers", () => {
    const restitution: Restitution = {
        version: 1,
        goals: [{ title: "G", steps: [{ why: "Do it, so it works." }] }],
    };

    it("pins each answer to the step that has its label now", () => {
        const result = pinAnswers(
            restitution,
            [{ step: "1.1", comment: " Why? ", answer: "Because. " }],
            7,
            () => "id",
        );
        expect(result).toEqual({
            ok: true,
            answers: [
                {
                    id: "id",
                    step: stepFingerprint({ why: "Do it, so it works." }),
                    label: "1.1",
                    comment: "Why?",
                    answer: "Because.",
                    at: 7,
                },
            ],
        });
    });

    it("keeps nothing when a label is wrong", () => {
        const result = pinAnswers(
            restitution,
            [
                { step: "1.1", comment: "a", answer: "b" },
                { step: "3.1", comment: "c", answer: "d" },
            ],
            7,
            () => "id",
        );
        expect(result).toEqual({
            ok: false,
            errors: ["There is no step 3.1."],
        });
    });
});

describe("storage and resolving", () => {
    it("round-trips, and reads a broken file as none", () => {
        const answers = [answer({})];
        expect(parseAnswers(serializeAnswers(answers))).toEqual(answers);
        expect(parseAnswers("{")).toEqual([]);
    });

    it("resolves and reopens an answer", () => {
        const on = applyReviewAction(EMPTY_REVIEW, {
            type: "resolve",
            answer: "a1",
            on: true,
        });
        expect(on.resolved).toEqual(["a1"]);
        expect(
            applyReviewAction(on, { type: "resolve", answer: "a1", on: false })
                .resolved,
        ).toEqual([]);
    });
});
