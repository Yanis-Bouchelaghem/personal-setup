import { useEffect, useMemo, useState } from "react";

import { uncoveredChanges } from "../core/coverage";
import type { FileDiff } from "../core/diff";
import type { Tab } from "../core/messages";
import type { SourceLines } from "../core/source";
import type { Host } from "./host";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { focusFirstInView } from "./useKeyboard";
import { useUnread } from "./useUnread";

/**
 * The tab strip and the tab you chose. You stay on it: a tab that changes or
 * appears behind your back only gets a dot, and nothing jumps while you read.
 * `focus` is the one exception, for a tab you just reopened.
 */
export function Tabs({
    tabs,
    diffs,
    sources,
    closed,
    focus,
    host,
}: {
    tabs: Tab[];
    diffs: Record<string, FileDiff>;
    sources: Record<string, SourceLines>;
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

    // Covered means shown by any guide, so this is one answer for every tab.
    const uncovered = useMemo(
        () =>
            uncoveredChanges(
                diffs,
                tabs.flatMap((tab) =>
                    tab.kind === "ok" ? [tab.restitution] : [],
                ),
            ),
        [diffs, tabs],
    );

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
                sources={sources}
                uncovered={uncovered}
                host={host}
                onCycleTab={(by) => {
                    const at = tabs.indexOf(active);
                    const next = tabs[(at + by + tabs.length) % tabs.length];
                    setSelected(next?.id);
                    // The new tab is drawn on the next frame: keep the cursor.
                    requestAnimationFrame(() =>
                        requestAnimationFrame(focusFirstInView),
                    );
                }}
            />
        </>
    );
}
