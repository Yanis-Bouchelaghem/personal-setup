import { useEffect, useState } from "react";

import type { ViewState } from "../core/messages";
import { ErrorList } from "./ErrorList";
import type { Host } from "./host";
import { Notice } from "./Notice";
import { Tabs } from "./Tabs";

/** The panel: it shows whatever state the extension last sent. */
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
                <p>
                    Restitution shows what changed by comparing your files with
                    their last commit, using git. It works for any language, but
                    it needs a git repository.
                </p>
                {state.folder ? (
                    <button
                        className="primary-btn notice-action"
                        type="button"
                        onClick={() => host.send({ type: "initRepo" })}
                    >
                        Create a repository in {state.folder}
                    </button>
                ) : (
                    <p>Open a folder to get started.</p>
                )}
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
