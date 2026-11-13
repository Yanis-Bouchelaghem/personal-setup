import { useEffect, useRef, useState } from "react";

import type { FileDiff } from "../core/diff";
import type { Tab, ViewState } from "../core/messages";
import { GoalSection } from "./GoalSection";
import type { Host } from "./host";
import { Notice } from "./Notice";
import { TabBar } from "./TabBar";

export function App({ host }: { host: Host }) {
    const [state, setState] = useState<ViewState>({ status: "empty" });

    useEffect(() => {
        const unsubscribe = host.subscribe(setState);
        host.send({ type: "ready" });
        return unsubscribe;
    }, [host]);

    return (
        <main className="app">
            <Body state={state} host={host} />
        </main>
    );
}

function Body({ state, host }: { state: ViewState; host: Host }) {
    if (state.status === "no-repo") {
        return (
            <Notice title="No git repository">
                Open a folder inside a git repository to see a restitution.
            </Notice>
        );
    }
    if (state.status === "empty") {
        return (
            <Notice title="Nothing to read yet">
                Ask your agent to explain the change it just made. It will
                appear here.
            </Notice>
        );
    }
    if (state.status === "error") {
        return (
            <Notice title="Something went wrong" tone="error">
                <ErrorList errors={state.errors} />
            </Notice>
        );
    }
    return <Tabs tabs={state.tabs} diffs={state.diffs} host={host} />;
}

function ErrorList({ errors }: { errors: string[] }) {
    return (
        <ul className="errors">
            {errors.map((error) => (
                <li key={error}>
                    <code>{error}</code>
                </li>
            ))}
        </ul>
    );
}

/**
 * Stay on the tab you chose. A tab that changes or appears behind your back
 * only gets a dot: nothing jumps while you read.
 */
function Tabs({
    tabs,
    diffs,
    host,
}: {
    tabs: Tab[];
    diffs: Record<string, FileDiff>;
    host: Host;
}) {
    const [selected, setSelected] = useState<string>();
    const [seen, setSeen] = useState<Record<string, number>>({});
    const initialized = useRef(false);

    const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];
    const activeId = active?.id;

    useEffect(() => {
        // The first state, and the tab you are looking at, count as seen.
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

    if (!active) {
        return null;
    }
    const unread = new Set(
        initialized.current
            ? tabs
                  .filter(
                      (tab) =>
                          tab.id !== activeId &&
                          (seen[tab.id] ?? -1) < tab.updatedAt,
                  )
                  .map((tab) => tab.id)
            : [],
    );

    return (
        <>
            <TabBar
                tabs={tabs}
                activeId={active.id}
                unread={unread}
                onSelect={setSelected}
                onClose={(id) => host.send({ type: "closeTab", id })}
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

function TabContent({
    tab,
    diffs,
    host,
}: {
    tab: Tab;
    diffs: Record<string, FileDiff>;
    host: Host;
}) {
    if (tab.kind === "error") {
        return (
            <Notice title="This restitution can't be shown" tone="error">
                <ErrorList errors={tab.errors} />
            </Notice>
        );
    }
    const { restitution } = tab;
    return (
        <>
            {restitution.request && (
                <p className="request">{restitution.request}</p>
            )}
            {restitution.goals.map((goal, index) => (
                <GoalSection
                    key={`${index}-${goal.title}`}
                    goal={goal}
                    number={index + 1}
                    diffs={diffs}
                    onOpenRequest={(request) => host.send(request)}
                />
            ))}
        </>
    );
}
