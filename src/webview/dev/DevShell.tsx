import { useEffect, useMemo, useState } from "react";

import type { ViewState } from "../../core/messages";
import { App } from "../App";
import type { Host } from "../host";
import { fixtures } from "./fixtures";

const params = new URLSearchParams(location.search);

function fixtureHost(state: ViewState): Host {
    return {
        subscribe(listener) {
            listener({ type: "state", state });
            return () => undefined;
        },
        send: (message) => console.info("to host:", message),
    };
}

/** Browser-only wrapper: pick a fixture and a theme to review the UI. */
export function DevShell() {
    const [theme, setTheme] = useState(params.get("theme") ?? "dark");
    const [fixture, setFixture] = useState(params.get("fixture") ?? "many");
    const bare = params.get("bare") === "1";

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.add("dev");
    }, [theme]);

    // `?width=600` widens the panel, to see the layout in a wide side bar.
    useEffect(() => {
        const width = params.get("width");
        const root = document.getElementById("root");
        if (width && root) {
            root.style.maxWidth = `${width}px`;
        }
    }, []);

    // `?state=/x.json` shows a real ViewState, e.g. one dumped from a repo.
    const [loaded, setLoaded] = useState<ViewState>();
    useEffect(() => {
        const url = params.get("state");
        if (url) {
            fetch(url)
                .then((response) => response.json())
                .then(setLoaded)
                .catch(() => undefined);
        }
    }, []);

    const host = useMemo(
        () =>
            fixtureHost(
                loaded ?? fixtures[fixture] ?? { status: "empty", closed: 0 },
            ),
        [fixture, loaded],
    );

    return (
        <>
            {!bare && (
                <div className="dev-toolbar">
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                    >
                        <option value="dark">dark</option>
                        <option value="light">light</option>
                    </select>
                    <select
                        value={fixture}
                        onChange={(e) => setFixture(e.target.value)}
                    >
                        {Object.keys(fixtures).map((name) => (
                            <option key={name}>{name}</option>
                        ))}
                    </select>
                </div>
            )}
            <App key={fixture} host={host} />
        </>
    );
}
