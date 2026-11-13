import { describe, expect, it } from "vitest";

import { isTabId, newTabId, tabIds } from "./paths";

describe("ids", () => {
    it("accepts plain ids and rejects anything that could escape the folder", () => {
        expect(isTabId("ok-id-1")).toBe(true);
        expect(isTabId(newTabId())).toBe(true);
        expect(isTabId(".hidden")).toBe(false);
        expect(isTabId("../up")).toBe(false);
        expect(isTabId("a/b")).toBe(false);
        expect(isTabId("")).toBe(false);
    });

    it("makes ids that differ", () => {
        expect(newTabId()).not.toBe(newTabId());
    });
});

describe("tabIds", () => {
    it("keeps <id>.json and drops everything else", () => {
        expect(
            tabIds([
                "a.json",
                "a.review.json",
                "b.json.123.tmp",
                ".c.json",
                "notes.txt",
                "archive",
                "d-2.json",
            ]),
        ).toEqual(["a", "d-2"]);
    });
});
