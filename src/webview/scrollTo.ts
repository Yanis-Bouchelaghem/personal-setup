/** How long a jump to a goal takes: quick, but you still see where you went. */
const JUMP_MS = 260;
/** Moving the keyboard cursor: just enough to follow it, and keys can repeat. */
const FOLLOW_MS = 120;

/** The running scroll, so a new one replaces it instead of fighting it. */
let running = 0;

/** Scroll the page to `y` with an ease-out; instant under reduced motion. */
function scrollToY(y: number, duration: number): void {
    const start = window.scrollY;
    const end = Math.max(
        0,
        Math.min(y, document.documentElement.scrollHeight - window.innerHeight),
    );
    cancelAnimationFrame(running);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, end);
        return;
    }
    const began = performance.now();
    const step = (now: number) => {
        const t = Math.min(1, (now - began) / duration);
        const eased = 1 - (1 - t) ** 3;
        window.scrollTo(0, start + (end - start) * eased);
        if (t < 1) {
            running = requestAnimationFrame(step);
        }
    };
    running = requestAnimationFrame(step);
}

/** Back to the very top: the request and the overview. */
export function scrollToTop(): void {
    scrollToY(0, JUMP_MS);
}

function marginTop(element: Element): number {
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
