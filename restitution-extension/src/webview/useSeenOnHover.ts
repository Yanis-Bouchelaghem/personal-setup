import { useEffect, useRef } from "react";

/** How long the pointer rests on a card before it counts as seen. */
const DWELL_MS = 500;

/**
 * Handlers that call `onSeen` once the pointer, or the keyboard cursor, has
 * rested on the element for a moment. The pause keeps a card from counting
 * as seen just because it scrolled past under a still pointer, or the cursor
 * went through it on the way somewhere else.
 */
export function useSeenOnHover(active: boolean, onSeen: () => void) {
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const stop = () => clearTimeout(timer.current);
    useEffect(() => stop, []);

    const start = () => {
        if (active) {
            stop();
            timer.current = setTimeout(onSeen, DWELL_MS);
        }
    };
    return {
        onMouseEnter: start,
        onMouseLeave: stop,
        onFocus: start,
        onBlur: stop,
    };
}
