import type { Restitution } from "./restitution";

/** What the panel shows. The extension computes it, the webview renders it. */
export type ViewState =
    | { status: "no-repo" }
    | { status: "empty" }
    | { status: "ok"; restitution: Restitution }
    | { status: "error"; errors: string[] };

export type ToWebview = { type: "state"; state: ViewState };

export type FromWebview = { type: "ready" };
