import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/**
 * Whether a step header has room for its button labels. They stay until the
 * file name would be cut (the folder gives way first) or the buttons would
 * not fit, and come back once the header is wide enough again. Checked before paint, so nothing flickers.
 */
export function useLabelsFit(head: RefObject<HTMLElement | null>): boolean {
    const [fit, setFit] = useState(true);
    // The header width the labels need, learnt when they last did not fit.
    const needed = useRef(0);

    useLayoutEffect(() => {
        const check = () => {
            const element = head.current;
            if (!element) {
                return;
            }
            const width = element.clientWidth;
            if (!fit) {
                if (width >= needed.current) {
                    setFit(true);
                }
                return;
            }
            // The name is cut, or the header overflows (on a narrow card
            // with no file name, the buttons themselves would be clipped).
            const cut = Math.max(
                nameCut(element),
                element.scrollWidth - element.clientWidth,
            );
            if (cut > 0.01) {
                needed.current = width + cut;
                setFit(false);
            }
        };
        check();
        const observer = new ResizeObserver(check);
        if (head.current) {
            observer.observe(head.current);
        }
        return () => observer.disconnect();
    }, [head, fit]);

    return fit;
}

/**
 * How many pixels of the file name are cut off. Measured on the text itself,
 * because element widths are rounded and miss a name cut by a fraction of a
 * pixel, which still shows an ellipsis.
 */
function nameCut(head: HTMLElement): number {
    const name = head.querySelector(".chip .name");
    if (!name) {
        return 0;
    }
    const text = document.createRange();
    text.selectNodeContents(name);
    return (
        text.getBoundingClientRect().width - name.getBoundingClientRect().width
    );
}
