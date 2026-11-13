import type { FileDiff } from "./diff";
import type { Restitution } from "./restitution";

/** What the panel shows. The extension computes it, the webview renders it. */
export type ViewState =
    | { status: "no-repo" }
    | { status: "empty" }
    | {
          status: "ok";
          restitution: Restitution;
          /** Working-tree diffs for the files the steps point at, by path. */
          diffs: Record<string, FileDiff>;
      }
    | { status: "error"; errors: string[] };

export type ToWebview = { type: "state"; state: ViewState };

export type OpenDiff = {
    type: "openDiff";
    file: string;
    line?: number;
    status?: FileDiff["status"];
};

export type FromWebview = { type: "ready" } | OpenDiff;
