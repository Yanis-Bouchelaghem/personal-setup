import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Folding changes a box's height. Call `remember()` just before the change and
 * the box is put back where its (pinned) header was once it has re-rendered,
 * so what you were reading doesn't jump.
 */
export function useScrollAnchor<B extends HTMLElement, H extends HTMLElement>(
    changed: unknown,
): {
    box: RefObject<B | null>;
    head: RefObject<H | null>;
    remember: () => void;
} {
    const box = useRef<B>(null);
    const head = useRef<H>(null);
    const anchor = useRef<number | undefined>(undefined);

    useLayoutEffect(() => {
        if (anchor.current !== undefined && box.current) {
            const drift =
                box.current.getBoundingClientRect().top - anchor.current;
            window.scrollBy(0, drift);
            anchor.current = undefined;
        }
    }, [changed]);

    const remember = () => {
        anchor.current = head.current?.getBoundingClientRect().top;
    };
    return { box, head, remember };
}
