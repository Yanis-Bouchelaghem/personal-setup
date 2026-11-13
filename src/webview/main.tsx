import { createRoot } from "react-dom/client";

import { App } from "./App";
import { inVsCode, vscodeHost } from "./host";

import "./theme.css";

async function boot(): Promise<void> {
    const container = document.getElementById("root");
    if (!container) {
        return;
    }
    const root = createRoot(container);
    if (inVsCode) {
        root.render(<App host={vscodeHost()} />);
    } else if (import.meta.env.DEV) {
        // Browser harness with fixtures and a theme switcher. Dev only.
        await import("./dev/themes.css");
        const { DevShell } = await import("./dev/DevShell");
        root.render(<DevShell />);
    }
}

void boot();
