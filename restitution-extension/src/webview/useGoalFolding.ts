import { useEffect, useRef, useState } from "react";

import { scrollToElement } from "./scrollTo";

/**
 * Which goals are folded. A goal whose steps are all viewed folds itself, and
 * unfolds again when that stops being true (the agent changed one of its
 * steps). What you fold or unfold by hand wins until that happens.
 */
export function useGoalFolding(allViewed: boolean[]) {
    // Your own choice per goal; without one, a goal folds when all is viewed.
    const [manual, setManual] = useState<ReadonlyMap<number, boolean>>(
        new Map(),
    );
    const previous = useRef(allViewed);

    // When a goal becomes fully viewed (or stops being), forget the choice.
    const key = allViewed.join(",");
    useEffect(() => {
        const changed = allViewed.flatMap((done, goal) =>
            done === previous.current[goal] ? [] : [goal],
        );
        previous.current = allViewed;
        if (changed.length > 0) {
            setManual((current) => {
                const next = new Map(current);
                changed.forEach((goal) => next.delete(goal));
                return next;
            });
        }
    }, [key]);

    const isFolded = (goal: number) =>
        manual.get(goal) ?? allViewed[goal] ?? false;

    const toggle = (goal: number) =>
        setManual((current) => new Map(current).set(goal, !isFolded(goal)));

    /** Fold or unfold every goal (zC, zO). */
    const setAll = (folded: boolean) =>
        setManual(new Map(allViewed.map((_, goal) => [goal, folded])));

    /** Scroll to a goal once it is drawn, and flash it so the eye lands. */
    const reveal = (goal: number) => {
        setManual((current) => new Map(current).set(goal, false));
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const target = document.querySelector(
                    `[data-goal="${goal + 1}"]`,
                );
                if (target) {
                    scrollToElement(target);
                }
                target?.classList.add("flash");
                setTimeout(() => target?.classList.remove("flash"), 1400);
            }),
        );
    };

    return { isFolded, toggle, setAll, reveal };
}
