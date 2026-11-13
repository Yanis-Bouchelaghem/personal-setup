import type { FromWebview, ToWebview, ViewState } from "../core/messages";

/** How the app talks to its surroundings: VS Code, or fixtures in a browser. */
export interface Host {
    subscribe(listener: (state: ViewState) => void): () => void;
    send(message: FromWebview): void;
}

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

export const inVsCode = typeof acquireVsCodeApi === "function";

export function vscodeHost(): Host {
    const api = acquireVsCodeApi();
    return {
        subscribe(listener) {
            const onMessage = (event: MessageEvent<ToWebview>) => {
                if (event.data.type === "state") {
                    listener(event.data.state);
                }
            };
            window.addEventListener("message", onMessage);
            return () => window.removeEventListener("message", onMessage);
        },
        send: (message) => api.postMessage(message),
    };
}
