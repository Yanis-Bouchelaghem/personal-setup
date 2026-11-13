import { useEffect, useRef } from "react";

/** How long the pointer rests on a card before it counts as seen. */
const DWELL_MS = 500;

/**
 * Pointer handlers that call `onSeen` once the pointer has rested on the
 * element for a moment. The pause keeps a card from counting as seen just
 * because it scrolled past under a still pointer.
 */
export function useSeenOnHover(active: boolean, onSeen: () => void) {
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const stop = () => clearTimeout(timer.current);
    useEffect(() => stop, []);

    return {
        onMouseEnter: () => {
            if (active) {
                stop();
                timer.current = setTimeout(onSeen, DWELL_MS);
            }
        },
        onMouseLeave: stop,
    };
}
