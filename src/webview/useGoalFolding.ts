import { useState } from "react";

/** Which goals are folded, and a way to jump to one (unfolding it first). */
export function useGoalFolding() {
    const [folded, setFolded] = useState<ReadonlySet<number>>(new Set());

    const toggle = (goal: number) =>
        setFolded((previous) => {
            const next = new Set(previous);
            if (!next.delete(goal)) {
                next.add(goal);
            }
            return next;
        });

    /** Scroll to a goal once it is drawn, and flash it so the eye lands. */
    const reveal = (goal: number) => {
        setFolded((previous) => {
            const next = new Set(previous);
            next.delete(goal);
            return next;
        });
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const target = document.querySelector(
                    `[data-goal="${goal + 1}"]`,
                );
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
                target?.classList.add("flash");
                setTimeout(() => target?.classList.remove("flash"), 1400);
            }),
        );
    };

    return { folded, toggle, reveal };
}
