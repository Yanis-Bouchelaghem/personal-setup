import { describe, expect, it } from "vitest";

import { KEYMAP, keyName, keyReader } from "./keys";

/** What each key read to: a command (with its count when more than one). */
function readAll(names: string[], gap = 10) {
    const read = keyReader();
    return names.map((name, index) => {
        const result = read(name, index * gap);
        if (result === undefined || result === "pending") {
            return result;
        }
        return result.count === 1
            ? result.command
            : `${result.count}×${result.command}`;
    });
}

describe("keyReader", () => {
    it("reads single keys and arrows", () => {
        expect(
            readAll([
                "j",
                "ArrowDown",
                "ArrowLeft",
                "l",
                "G",
                "c",
                "a",
                "Escape",
            ]),
        ).toEqual([
            "next",
            "next",
            "parent",
            "child",
            "last",
            "comment",
            "toggle",
            "leave",
        ]);
    });

    it("reads two-key sequences", () => {
        expect(readAll(["g", "g", "z", "c", "]", "c"])).toEqual([
            "pending",
            "first",
            "pending",
            "fold",
            "pending",
            "nextChange",
        ]);
    });

    it("reads a count before a command, like 3j or 12k", () => {
        expect(readAll(["3", "j", "1", "2", "k", "j"])).toEqual([
            "pending",
            "3×next",
            "pending",
            "pending",
            "12×prev",
            "next",
        ]);
    });

    it("does not start a count with 0", () => {
        expect(readAll(["0", "j"])).toEqual([undefined, "next"]);
    });

    it("drops a sequence that goes nowhere (gq), then reads on", () => {
        expect(readAll(["g", "q", "j"])).toEqual([
            "pending",
            undefined,
            "next",
        ]);
    });

    it("forgets a count or sequence left unfinished too long", () => {
        expect(readAll(["g", "j"], 1500)).toEqual(["pending", "next"]);
        expect(readAll(["5", "j"], 1500)).toEqual(["pending", "next"]);
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
