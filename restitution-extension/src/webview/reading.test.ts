import { describe, expect, it } from "vitest";

import { centerShift, endPadding, throughCard } from "./reading";

describe("endPadding", () => {
    it("is a fifth of the area, never less than a few lines", () => {
        expect(endPadding(640)).toBe(128);
        expect(endPadding(100)).toBe(48);
    });
});

describe("throughCard", () => {
    it("scrolls while the card reaches past the stop and the page has room", () => {
        expect(throughCard(300, 900, false, false)).toBe("scroll");
        expect(throughCard(300, 900, true, true)).toBe("scroll");
    });

    it("moves on at the end for a fresh press", () => {
        expect(throughCard(2, 900, false, true)).toBe("leave");
        expect(throughCard(-50, 900, false, false)).toBe("leave");
    });

    it("holds at the end for a key held while scrolling through the card", () => {
        expect(throughCard(2, 900, true, true)).toBe("hold");
    });

    it("lets a held key move on when it was not scrolling through this card", () => {
        // Holding `j` across short cards keeps flying through them.
        expect(throughCard(-10, 900, true, false)).toBe("leave");
    });

    it("treats a page that can't scroll further as the end, not a dead key", () => {
        expect(throughCard(300, 0, false, false)).toBe("leave");
        expect(throughCard(300, 0.4, true, true)).toBe("hold");
    });
});

describe("centerShift", () => {
    it("centres a box that fits, scrolling down when it is low", () => {
        // Area 100..700 (600 tall), box 500..600 (100 tall): centre at 550, wanted 400.
        expect(centerShift(500, 600, 100, 700)).toBe(150);
    });

    it("scrolls up when the box is high", () => {
        expect(centerShift(110, 210, 100, 700)).toBe(-240);
    });

    it("does not move a box that is already centred", () => {
        expect(centerShift(350, 450, 100, 700)).toBe(0);
    });

    it("puts the end of a tall box where scrolling down would stop, coming from below", () => {
        // Area 100..700 (600 tall): the end rests a fifth (120) above the bottom edge.
        expect(centerShift(-300, 700, 100, 700, true)).toBe(120);
        // A box that fits is centred whichever way you came.
        expect(centerShift(500, 600, 100, 700, true)).toBe(150);
    });

    it("puts the top of a box taller than the area at the top", () => {
        expect(centerShift(500, 1500, 100, 700)).toBe(400);
        expect(centerShift(-300, 700, 100, 700)).toBe(-400);
    });
});
