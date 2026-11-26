/**
 * How the keyboard cursor reads through cards: pure decisions, no DOM, so the
 * scrolling code around them stays thin.
 */

/** What `j` and `k` do on a card: scroll through it, hold, or move on. */
export type Through = "scroll" | "hold" | "leave";

/** Pixels of the card still out of the way, and under which it counts as shown. */
const SHOWN = 4;

/**
 * How far above the bottom edge a card's end comes to rest when scrolling
 * down through it: a fifth of the reading area, so the end is clearly in sight
 * (with a glimpse of what follows) and there is time to stop pressing.
 */
export function endPadding(area: number): number {
    return Math.max(48, area / 5);
}

/**
 * What a move does on a card the screen may not hold. `hidden` is how far the
 * card still reaches past where reading should stop, `room` how far the page
 * can still scroll that way. At the end, a key that is held down and has been
 * scrolling through the card holds still until it is released, so a long card
 * does not hand you to the next one before you can react; a fresh press moves on.
 */
export function throughCard(
    hidden: number,
    room: number,
    held: boolean,
    scrolling: boolean,
): Through {
    if (hidden > SHOWN && room >= 1) {
        return "scroll";
    }
    return held && scrolling ? "hold" : "leave";
}

/**
 * How far to scroll to centre a box in the reading area (between `areaTop` and
 * `areaBottom`, in window coordinates). A box taller than the area can't be
 * centred: its top wins, because that is where reading starts.
 */
export function centerShift(
    top: number,
    bottom: number,
    areaTop: number,
    areaBottom: number,
): number {
    const free = areaBottom - areaTop - (bottom - top);
    return top - areaTop - Math.max(0, free) / 2;
}
