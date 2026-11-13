import { describe, expect, it } from "vitest";

import {
    applyReviewAction,
    EMPTY_REVIEW,
    parseReview,
    pendingRequests,
    type Review,
    serializeReview,
} from "./review";

const ask = (step: string, clarify: boolean, comment?: string) =>
    ({ type: "request", step, label: "1.1", clarify, comment }) as const;

describe("parsing", () => {
    it("round-trips", () => {
        const review: Review = {
            viewed: ["a"],
            known: ["a", "b"],
            requests: [{ step: "b", label: "1.2", clarify: true }],
        };
        expect(parseReview(serializeReview(review))).toEqual(review);
    });

    it("reads damaged files as an empty review", () => {
        expect(parseReview("{ nope")).toEqual(EMPTY_REVIEW);
        expect(parseReview('{"version":2}')).toEqual(EMPTY_REVIEW);
        expect(parseReview('{"version":1,"viewed":[1]}')).toEqual(EMPTY_REVIEW);
    });

    it("keeps `known` absent until the first look", () => {
        expect(parseReview('{"version":1}').known).toBeUndefined();
    });
});

describe("viewed and known", () => {
    it("viewing a step folds it and makes it known; un-viewing keeps it known", () => {
        const viewed = applyReviewAction(EMPTY_REVIEW, {
            type: "viewed",
            step: "a",
            on: true,
        });
        expect(viewed).toMatchObject({ viewed: ["a"], known: ["a"] });
        const unviewed = applyReviewAction(viewed, {
            type: "viewed",
            step: "a",
            on: false,
        });
        expect(unviewed).toMatchObject({ viewed: [], known: ["a"] });
    });

    it("adds known steps without duplicates", () => {
        const once = applyReviewAction(EMPTY_REVIEW, {
            type: "known",
            steps: ["a", "b"],
        });
        expect(
            applyReviewAction(once, { type: "known", steps: ["b", "c"] }).known,
        ).toEqual(["a", "b", "c"]);
    });
});

describe("requests", () => {
    it("sets, replaces and removes the request on a step", () => {
        const clarify = applyReviewAction(EMPTY_REVIEW, ask("a", true));
        expect(clarify.requests).toEqual([
            { step: "a", label: "1.1", clarify: true },
        ]);
        const commented = applyReviewAction(clarify, ask("a", true, " Why? "));
        expect(commented.requests).toEqual([
            { step: "a", label: "1.1", clarify: true, comment: "Why?" },
        ]);
        expect(
            applyReviewAction(commented, ask("a", false, "  ")).requests,
        ).toEqual([]);
    });

    it("marks requests sent, and an edit un-sends that one", () => {
        let review = applyReviewAction(EMPTY_REVIEW, ask("a", true));
        review = applyReviewAction(review, ask("b", false, "Why?"));
        review = applyReviewAction(review, { type: "sent", at: 100 });
        expect(review.requests.every((request) => request.sentAt === 100)).toBe(
            true,
        );
        review = applyReviewAction(review, ask("b", false, "Why not?"));
        expect(
            review.requests.find((r) => r.step === "b")?.sentAt,
        ).toBeUndefined();
    });

    it("resets", () => {
        const review = applyReviewAction(EMPTY_REVIEW, ask("a", true));
        expect(applyReviewAction(review, { type: "reset" }).requests).toEqual(
            [],
        );
    });

    it("counts a sent request as answered once the restitution is rewritten", () => {
        let review = applyReviewAction(EMPTY_REVIEW, ask("a", true));
        review = applyReviewAction(review, { type: "sent", at: 100 });
        review = applyReviewAction(review, ask("b", true));
        expect(pendingRequests(review, 50).map((r) => r.step)).toEqual([
            "a",
            "b",
        ]);
        expect(pendingRequests(review, 150).map((r) => r.step)).toEqual(["b"]);
    });
});
