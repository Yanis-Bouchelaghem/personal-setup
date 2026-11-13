import { useEffect, useState } from "react";

import type { FileDiff } from "../core/diff";
import type { Tab } from "../core/messages";
import type { Host } from "./host";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { useUnread } from "./useUnread";

/**
 * The tab strip and the tab you chose. You stay on it: a tab that changes or
 * appears behind your back only gets a dot, and nothing jumps while you read.
 * `focus` is the one exception, for a tab you just reopened.
 */
export function Tabs({
    tabs,
    diffs,
    closed,
    focus,
    host,
}: {
    tabs: Tab[];
    diffs: Record<string, FileDiff>;
    closed: number;
    focus: { id: string } | undefined;
    host: Host;
}) {
    const [selected, setSelected] = useState<string | undefined>(focus?.id);
    useEffect(() => {
        if (focus) {
            setSelected(focus.id);
        }
    }, [focus]);

    const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];
    const unread = useUnread(tabs, active?.id);

    if (!active) {
        return null;
    }
    return (
        <>
            <TabBar
                tabs={tabs}
                activeId={active.id}
                unread={unread}
                closed={closed}
                onSelect={setSelected}
                onClose={(id) => host.send({ type: "closeTab", id })}
                onReopen={() => host.send({ type: "reopenTab" })}
            />
            <TabContent
                key={active.id}
                tab={active}
                diffs={diffs}
                host={host}
            />
        </>
    );
}
