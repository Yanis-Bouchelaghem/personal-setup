import { centerShift } from "./reading";

/** How long a jump to a goal takes: quick, but you still see where you went. */
const JUMP_MS = 260;
/** Moving the keyboard cursor: just enough to follow it, and keys can repeat. */
const FOLLOW_MS = 120;

/** The running scroll, so a new one replaces it instead of fighting it. */
let running = 0;
/** Where the running scroll is going, so moves made meanwhile add up. */
let heading: number | undefined;

/** Scroll the page to `y` with an ease-out; instant under reduced motion. */
function scrollToY(y: number, duration: number): void {
    const start = window.scrollY;
    const end = Math.max(
        0,
        Math.min(y, document.documentElement.scrollHeight - window.innerHeight),
    );
    cancelAnimationFrame(running);
    heading = end;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, end);
        heading = undefined;
        return;
    }
    const began = performance.now();
    const step = (now: number) => {
        const t = Math.min(1, (now - began) / duration);
        const eased = 1 - (1 - t) ** 3;
        window.scrollTo(0, start + (end - start) * eased);
        if (t < 1) {
            running = requestAnimationFrame(step);
        } else {
            heading = undefined;
        }
    };
    running = requestAnimationFrame(step);
}

/**
 * How much further the page is about to scroll: what a measurement taken now
 * must allow for, so keys pressed during a scroll build on where it goes.
 */
export function scrollAhead(): number {
    return (heading ?? window.scrollY) - window.scrollY;
}

/**
 * How far the page can still scroll down (1) or up (-1) from where it is
 * heading: a key that scrolls must not wait for room that is not there.
 */
export function scrollRoom(direction: 1 | -1): number {
    const at = window.scrollY + scrollAhead();
    const last = document.documentElement.scrollHeight - window.innerHeight;
    return direction === 1 ? last - at : at;
}

/** Scroll by `by` pixels from where the page is heading, quickly. */
export function scrollLines(by: number): void {
    scrollToY(window.scrollY + scrollAhead() + by, FOLLOW_MS);
}

/** Back to the very top: the request and the overview. */
export function scrollToTop(): void {
    scrollToY(0, JUMP_MS);
}

/** Where an element sits under the pinned headers when scrolled to. */
export function marginTop(element: Element): number {
    return parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
}

/**
 * Scroll the page so `element` sits at its scroll-margin from the top. The
 * browser's own smooth scroll is slower and can't be tuned.
 */
export function scrollToElement(element: Element): void {
    const top = element.getBoundingClientRect().top + window.scrollY;
    scrollToY(top - marginTop(element), JUMP_MS);
}

/**
 * Scroll so `element` sits in the middle of the reading area (under the pinned
 * headers, above `bottom`), so moving between cards never leaves you looking at
 * the edge. When it is taller than the area, its top wins.
 */
export function centerElement(element: Element, bottom: number): void {
    const { top, bottom: end } = element.getBoundingClientRect();
    const by = centerShift(top, end, marginTop(element), bottom);
    if (Math.abs(by) >= 1) {
        scrollToY(window.scrollY + by, FOLLOW_MS);
    }
}

/**
 * Scroll as little as possible to show `element` between the pinned headers
 * and `bottom` (px from the top of the window). When it can't all fit, its
 * top wins: that is where reading starts.
 */
export function followElement(element: Element, bottom: number): void {
    const margin = marginTop(element);
    const { top, bottom: end } = element.getBoundingClientRect();
    const by =
        top < margin ? top - margin : Math.min(end - bottom, top - margin);
    if (top < margin || by > 0) {
        scrollToY(window.scrollY + by, FOLLOW_MS);
    }
}
