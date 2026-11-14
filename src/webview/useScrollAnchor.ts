import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/**
 * Folding changes a box's height. Call `remember()` just before the change and
 * the box is put back where its (pinned) header was once it has re-rendered,
 * so what you were reading doesn't jump.
 *
 * `snap` says whether that change should skip its animation: only when the
 * header was pinned (the box's top scrolled out of view), because the page
 * then has to scroll at the same moment. Otherwise the box opens and closes
 * in place, smoothly.
 */
export function useScrollAnchor<B extends HTMLElement, H extends HTMLElement>(
    changed: unknown,
): {
    box: RefObject<B | null>;
    head: RefObject<H | null>;
    remember: () => void;
    snap: boolean;
} {
    const box = useRef<B>(null);
    const head = useRef<H>(null);
    const anchor = useRef<number | undefined>(undefined);
    const [snap, setSnap] = useState(false);

    useLayoutEffect(() => {
        if (anchor.current !== undefined && box.current) {
            const drift =
                box.current.getBoundingClientRect().top - anchor.current;
            window.scrollBy(0, drift);
            anchor.current = undefined;
        }
        setSnap(false);
    }, [changed]);

    const remember = () => {
        const headTop = head.current?.getBoundingClientRect().top;
        const boxTop = box.current?.getBoundingClientRect().top;
        anchor.current = headTop;
        setSnap(
            headTop !== undefined &&
                boxTop !== undefined &&
                boxTop < headTop - 2,
        );
    };
    return { box, head, remember, snap };
}
