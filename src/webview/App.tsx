import { useEffect, useState } from "react";

import type { OpenRequest, ViewState } from "../core/messages";
import { GoalSection } from "./GoalSection";
import type { Host } from "./host";
import { Notice } from "./Notice";

export function App({ host }: { host: Host }) {
    const [state, setState] = useState<ViewState>({ status: "empty" });

    useEffect(() => {
        const unsubscribe = host.subscribe(setState);
        host.send({ type: "ready" });
        return unsubscribe;
    }, [host]);

    return (
        <main className="app">
            <Body
                state={state}
                onOpenRequest={(request) => host.send(request)}
            />
        </main>
    );
}

function Body({
    state,
    onOpenRequest,
}: {
    state: ViewState;
    onOpenRequest: (request: OpenRequest) => void;
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
            </Notice>
        );
    }
    if (state.status === "error") {
        return (
            <Notice title="This restitution can't be shown" tone="error">
                <ul className="errors">
                    {state.errors.map((error) => (
                        <li key={error}>
                            <code>{error}</code>
                        </li>
                    ))}
                </ul>
            </Notice>
        );
    }
    return (
        <>
            {state.restitution.request && (
                <p className="request">{state.restitution.request}</p>
            )}
            {state.restitution.goals.map((goal, index) => (
                <GoalSection
                    key={`${index}-${goal.title}`}
                    goal={goal}
                    number={index + 1}
                    diffs={state.diffs}
                    onOpenRequest={onOpenRequest}
                />
            ))}
        </>
    );
}
