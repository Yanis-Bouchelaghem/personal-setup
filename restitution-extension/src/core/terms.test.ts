import { describe, expect, it } from "vitest";

import type { Restitution } from "./restitution";
import {
    markTerms,
    plainText,
    splitTerms,
    TERM_COLOURS,
    termColours,
    termsOf,
} from "./terms";

describe("splitTerms", () => {
    it("splits backticked names out of the text", () => {
        expect(splitTerms("Add a `Store` class, so `load()` works.")).toEqual([
            { text: "Add a " },
            { text: "Store", term: "Store" },
            { text: " class, so " },
            { text: "load()", term: "load" },
            { text: " works." },
        ]);
    });

    it("leaves a lone or empty pair of backticks as text", () => {
        expect(splitTerms("a ` b")).toEqual([{ text: "a ` b" }]);
        expect(splitTerms("a `` b")).toEqual([{ text: "a `` b" }]);
    });

    it("gives plain text and the terms, each once", () => {
        const text = "`a` then `b` then `a`";
        expect(plainText(text)).toBe("a then b then a");
        expect(termsOf(text)).toEqual(["a", "b"]);
    });
});

const restitution = (titles: string[], whys: string[]): Restitution => ({
    version: 1,
    goals: titles.map((title) => ({
        title,
        steps: whys.map((why) => ({ why })),
    })),
});

describe("termColours", () => {
    it("numbers terms in page order, the same term keeping its slot", () => {
        const slots = termColours(
            restitution(["Add `B`"], ["Use `A` and `B`", "then `C`"]),
        );
        expect([...slots]).toEqual([
            ["B", 0],
            ["A", 1],
            ["C", 2],
        ]);
    });

    it("cycles through the colours when there are more terms", () => {
        const names = Array.from(
            { length: TERM_COLOURS + 1 },
            (_, i) => `\`t${i}\``,
        );
        const slots = termColours(restitution(["x"], [names.join(" ")]));
        expect(slots.get(`t${TERM_COLOURS}`)).toBe(0);
    });
});

describe("markTerms", () => {
    it("marks whole names only", () => {
        expect(
            markTerms("const store = new Store(storeKey);", ["Store", "store"]),
        ).toEqual([
            { text: "const " },
            { text: "store", term: "store" },
            { text: " = new " },
            { text: "Store", term: "Store" },
            { text: "(storeKey);" },
        ]);
    });

    it("prefers the longer term where two start together", () => {
        expect(markTerms("config.port", ["config", "config.port"])).toEqual([
            { text: "config.port", term: "config.port" },
        ]);
    });

    it("leaves a line without terms whole", () => {
        expect(markTerms("return x;", ["y"])).toEqual([{ text: "return x;" }]);
    });
});
