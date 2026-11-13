import { describe, expect, it } from "vitest";

import { parseViewed, serializeReview, withViewed } from "./review";

describe("review state", () => {
    it("round-trips", () => {
        expect(parseViewed(serializeReview(["a1", "b2"]))).toEqual([
            "a1",
            "b2",
        ]);
    });

    it("treats damaged files as nothing viewed", () => {
        expect(parseViewed("{ nope")).toEqual([]);
        expect(parseViewed('{"version":2,"viewed":["x"]}')).toEqual([]);
        expect(parseViewed('{"version":1,"viewed":[1]}')).toEqual([]);
    });

    it("adds and removes without duplicates", () => {
        expect(withViewed(["a"], "b", true)).toEqual(["a", "b"]);
        expect(withViewed(["a", "b"], "b", true)).toEqual(["a", "b"]);
        expect(withViewed(["a", "b"], "a", false)).toEqual(["b"]);
        expect(withViewed(["a"], "zzz", false)).toEqual(["a"]);
    });
});
