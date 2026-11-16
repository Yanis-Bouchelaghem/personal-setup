import { describe, expect, it } from "vitest";

import { KEYMAP, keyName, keyReader } from "./keys";

function readAll(names: string[], gap = 10) {
    const read = keyReader();
    return names.map((name, index) => read(name, index * gap));
}

describe("keyReader", () => {
    it("reads single keys", () => {
        expect(readAll(["j", "k", "G", "Y", "?", "Escape", "Enter"])).toEqual([
            "next",
            "prev",
            "last",
            "copy",
            "help",
            "leave",
            "open",
        ]);
    });

    it("reads two-key sequences", () => {
        expect(readAll(["g", "g", "z", "c", "g", "T"])).toEqual([
            "pending",
            "first",
            "pending",
            "fold",
            "pending",
            "prevTab",
        ]);
    });

    it("drops a sequence that goes nowhere, then reads on", () => {
        expect(readAll(["g", "x", "j"])).toEqual([
            "pending",
            undefined,
            "next",
        ]);
    });

    it("forgets a sequence left unfinished too long", () => {
        expect(readAll(["g", "j"], 1500)).toEqual(["pending", "next"]);
    });

    it("ignores keys that are not ours", () => {
        expect(readAll(["q", "ctrl+x"])).toEqual([undefined, undefined]);
    });
});

describe("keyName", () => {
    it("names ctrl keys in lower case", () => {
        expect(keyName({ key: "D", ctrlKey: true })).toBe("ctrl+d");
        expect(keyName({ key: "G", ctrlKey: false })).toBe("G");
    });
});

describe("KEYMAP", () => {
    it("binds each key once", () => {
        const keys = KEYMAP.flatMap((section) =>
            section.rows.flatMap((row) => row.keys),
        );
        expect(new Set(keys).size).toBe(keys.length);
    });
});
