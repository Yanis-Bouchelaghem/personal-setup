import { useEffect, useRef, useState } from "react";

import { type FileDiff, hunksForRange } from "../core/diff";
import { stepFingerprint } from "../core/fingerprint";
import type { Tab, ViewState } from "../core/messages";
import { GoalSection } from "./GoalSection";
import type { Host } from "./host";
import { Notice } from "./Notice";
import { Overview } from "./Overview";
import { TabBar } from "./TabBar";

export function App({ host }: { host: Host }) {
    const [state, setState] = useState<ViewState>({
        status: "empty",
        closed: 0,
    });
    // A new object on every request, so selecting the same tab twice still works.
    const [focus, setFocus] = useState<{ id: string }>();

    useEffect(() => {
        const unsubscribe = host.subscribe((message) => {
            if (message.type === "state") {
                setState(message.state);
            } else {
                setFocus({ id: message.id });
            }
        });
        host.send({ type: "ready" });
        return unsubscribe;
    }, [host]);

    return (
        <main className="app">
            <Body state={state} focus={focus} host={host} />
        </main>
    );
}

function Body({
    state,
    focus,
    host,
}: {
    state: ViewState;
    focus: { id: string } | undefined;
    host: Host;
}) {
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
                {state.closed > 0 && (
                    <button
                        className="text-btn"
                        type="button"
                        onClick={() => host.send({ type: "reopenTab" })}
                    >
                        Reopen a closed tab ({state.closed})
                    </button>
                )}
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
    return (
        <Tabs
            tabs={state.tabs}
            diffs={state.diffs}
            closed={state.closed}
            focus={focus}
            host={host}
        />
    );
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

function TabContent({
    tab,
    diffs,
    host,
}: {
    tab: Tab;
    diffs: Record<string, FileDiff>;
    host: Host;
}) {
    // Marking Viewed answers at once; the saved state follows and agrees.
    const saved = tab.kind === "ok" ? tab.viewed : [];
    const [viewed, setViewed] = useState<ReadonlySet<string>>(
        () => new Set(saved),
    );
    const [folded, setFolded] = useState<ReadonlySet<number>>(new Set());
    const savedKey = saved.join(",");
    useEffect(() => setViewed(new Set(saved)), [savedKey]);

    if (tab.kind === "error") {
        return (
            <Notice title="This restitution can't be shown" tone="error">
                <ErrorList errors={tab.errors} />
            </Notice>
        );
    }
    const { restitution } = tab;
    const labels = new Set(
        restitution.goals.flatMap((goal, goalIndex) =>
            goal.steps.map(
                (_, stepIndex) => `${goalIndex + 1}.${stepIndex + 1}`,
            ),
        ),
    );
    const fingerprints = restitution.goals.map((goal) =>
        goal.steps.map((step) =>
            stepFingerprint(
                step,
                hunksForRange(
                    step.file ? diffs[step.file] : undefined,
                    step.lines,
                ),
            ),
        ),
    );
    const done = fingerprints.map(
        (goalPrints) => goalPrints.filter((print) => viewed.has(print)).length,
    );

    const changeViewed = (fingerprint: string, on: boolean) => {
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
    const toggleFold = (goal: number) =>
        setFolded((previous) => {
            const next = new Set(previous);
            if (!next.delete(goal)) {
                next.add(goal);
            }
            return next;
        });
    // Unfold first when the target is inside a folded goal, then scroll once it is drawn.
    const reveal = (goal: number, selector: string) => {
        setFolded((previous) => {
            const next = new Set(previous);
            next.delete(goal);
            return next;
        });
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const target = document.querySelector(selector);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
                target?.classList.add("flash");
                setTimeout(() => target?.classList.remove("flash"), 1400);
            }),
        );
    };
    const gotoGoal = (goal: number) =>
        reveal(goal, `[data-goal="${goal + 1}"]`);
    const gotoStep = (label: string) =>
        reveal(Number(label.split(".")[0]) - 1, `[data-step="${label}"]`);

    return (
        <>
            {restitution.request && (
                <p className="request">{restitution.request}</p>
            )}
            {restitution.goals.length > 1 && (
                <Overview
                    goals={restitution.goals}
                    done={done}
                    onGoto={gotoGoal}
                />
            )}
            {restitution.goals.map((goal, index) => (
                <GoalSection
                    key={`${index}-${goal.title}`}
                    goal={goal}
                    number={index + 1}
                    fingerprints={fingerprints[index] ?? []}
                    viewed={viewed}
                    diffs={diffs}
                    folded={folded.has(index)}
                    labels={labels}
                    onToggleFold={() => toggleFold(index)}
                    onViewedChange={changeViewed}
                    onOpenRequest={(request) => host.send(request)}
                    onGoto={gotoStep}
                />
            ))}
        </>
    );
}
