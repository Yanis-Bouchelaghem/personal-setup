import { describe, expect, it } from "vitest";

import { splitRefs } from "./refs";

const known = new Set(["1.1", "1.2", "2.1"]);

describe("splitRefs", () => {
    it("turns known step labels into references", () => {
        expect(splitRefs("Needs retry.ts from 1.1 first.", known)).toEqual([
            { text: "Needs retry.ts from " },
            { ref: "1.1" },
            { text: " first." },
        ]);
    });

    it("finds several, at the edges too", () => {
        expect(splitRefs("2.1 and then 1.2", known)).toEqual([
            { ref: "2.1" },
            { text: " and then " },
            { ref: "1.2" },
        ]);
    });

    it("leaves unknown numbers alone", () => {
        expect(splitRefs("Bump to 3.4 after 1.1", known)).toEqual([
            { text: "Bump to 3.4 after " },
            { ref: "1.1" },
        ]);
    });

    it("keeps plain text whole", () => {
        expect(splitRefs("No numbers here.", known)).toEqual([
            { text: "No numbers here." },
        ]);
        expect(splitRefs("", known)).toEqual([]);
    });
});
