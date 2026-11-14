/** How long a jump to a goal takes: quick, but you still see where you went. */
const DURATION_MS = 260;

/**
 * Scroll the page so `element` sits at its scroll-margin from the top, with
 * a short ease-out. The browser's own smooth scroll is slower and can't be
 * tuned. Instant under reduced motion.
 */
export function scrollToElement(element: Element): void {
    const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    const start = window.scrollY;
    const end = Math.max(
        0,
        Math.min(
            element.getBoundingClientRect().top + start - margin,
            document.documentElement.scrollHeight - window.innerHeight,
        ),
    );
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, end);
        return;
    }
    const began = performance.now();
    const step = (now: number) => {
        const t = Math.min(1, (now - began) / DURATION_MS);
        const eased = 1 - (1 - t) ** 3;
        window.scrollTo(0, start + (end - start) * eased);
        if (t < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
}
