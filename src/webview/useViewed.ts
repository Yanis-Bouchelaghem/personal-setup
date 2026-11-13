import { useEffect, useState } from "react";

import type { Tab } from "../core/messages";
import type { Host } from "./host";

/**
 * Which steps are marked Viewed. Marking answers at once; the saved state
 * follows from the extension and agrees (or corrects it).
 */
export function useViewed(tab: Tab, host: Host) {
    const saved = tab.kind === "ok" ? tab.viewed : [];
    const [viewed, setViewed] = useState<ReadonlySet<string>>(
        () => new Set(saved),
    );
    const savedKey = saved.join(",");
    useEffect(() => setViewed(new Set(saved)), [savedKey]);

    const change = (fingerprint: string, on: boolean) => {
        setViewed((previous) => {
            const next = new Set(previous);
            if (on) {
                next.add(fingerprint);
            } else {
                next.delete(fingerprint);
            }
            return next;
        });
        host.send({
            type: "setViewed",
            tabId: tab.id,
            fingerprint,
            viewed: on,
        });
    };
    return { viewed, change };
}
