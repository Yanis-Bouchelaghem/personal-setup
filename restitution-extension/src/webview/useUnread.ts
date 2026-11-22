import { useEffect, useRef, useState } from "react";

import type { Tab } from "../core/messages";

/**
 * The tabs that changed, or appeared, while you were looking at another one.
 * The first state and the tab you are on count as seen, so nothing jumps and
 * nothing is flagged on load.
 */
export function useUnread(
    tabs: Tab[],
    activeId: string | undefined,
): ReadonlySet<string> {
    const [seen, setSeen] = useState<Record<string, number>>({});
    const initialized = useRef(false);

    useEffect(() => {
        setSeen((previous) => {
            const next = { ...previous };
            for (const tab of tabs) {
                if (!initialized.current || tab.id === activeId) {
                    next[tab.id] = tab.updatedAt;
                }
            }
            return next;
        });
        initialized.current = true;
    }, [tabs, activeId]);

    if (!initialized.current) {
        return new Set();
    }
    return new Set(
        tabs
            .filter(
                (tab) =>
                    tab.id !== activeId && (seen[tab.id] ?? -1) < tab.updatedAt,
            )
            .map((tab) => tab.id),
    );
}
