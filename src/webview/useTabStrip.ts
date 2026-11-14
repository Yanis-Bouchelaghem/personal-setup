import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

type Strip = {
    /** More tabs than fit: the arrows are shown. */
    overflow: boolean;
    atStart: boolean;
    atEnd: boolean;
    /** Scroll most of a strip's width to the left (-1) or right (1). */
    page: (direction: -1 | 1) => void;
};

/**
 * Scrolling for a tab strip, for people without a trackpad: arrows that page
 * through the tabs, and a mouse wheel that scrolls it sideways. The active
 * tab is kept in view.
 */
export function useTabStrip(
    strip: RefObject<HTMLElement | null>,
    tabCount: number,
    activeId: string,
): Strip {
    const [state, setState] = useState({
        overflow: false,
        atStart: true,
        atEnd: true,
    });

    useLayoutEffect(() => {
        const element = strip.current;
        if (!element) {
            return undefined;
        }
        const measure = () => {
            const end = element.scrollWidth - element.clientWidth;
            const next = {
                overflow: end > 1,
                atStart: element.scrollLeft <= 1,
                atEnd: element.scrollLeft >= end - 1,
            };
            setState((current) =>
                current.overflow === next.overflow &&
                current.atStart === next.atStart &&
                current.atEnd === next.atEnd
                    ? current
                    : next,
            );
        };
        // A vertical wheel scrolls the strip sideways instead of the page.
        const wheel = (event: WheelEvent) => {
            const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
            const end = element.scrollWidth - element.clientWidth;
            if (!sideways && end > 1) {
                event.preventDefault();
                element.scrollLeft += event.deltaY;
            }
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        element.addEventListener("scroll", measure, { passive: true });
        element.addEventListener("wheel", wheel, { passive: false });
        return () => {
            observer.disconnect();
            element.removeEventListener("scroll", measure);
            element.removeEventListener("wheel", wheel);
        };
    }, [strip, tabCount]);

    useEffect(() => {
        strip.current
            ?.querySelector(".tab.active")
            ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [strip, activeId, tabCount]);

    const page = (direction: -1 | 1) => {
        const element = strip.current;
        if (element) {
            element.scrollBy({
                left: direction * element.clientWidth * 0.8,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
            });
        }
    };

    return { ...state, page };
}
