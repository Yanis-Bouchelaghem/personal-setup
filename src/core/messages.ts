import type { FileDiff } from "./diff";
import type { Restitution } from "./restitution";

/** One restitution file, shown as a tab. A broken file only breaks its own tab. */
export type Tab =
    | {
          kind: "ok";
          id: string;
          label: string;
          updatedAt: number;
          restitution: Restitution;
      }
    | {
          kind: "error";
          id: string;
          label: string;
          updatedAt: number;
          errors: string[];
      };

/** What the panel shows. The extension computes it, the webview renders it. */
export type ViewState =
    | { status: "no-repo" }
    | { status: "empty" }
    | { status: "error"; errors: string[] }
    | {
          status: "ok";
          /** Newest first. */
          tabs: Tab[];
          /** Working-tree diffs for the files any step points at, by path. */
          diffs: Record<string, FileDiff>;
      };

export type ToWebview = { type: "state"; state: ViewState };

export type OpenDiff = {
    type: "openDiff";
    file: string;
    line?: number;
    status?: FileDiff["status"];
};

export type OpenFile = { type: "openFile"; file: string; line?: number };

/** Both buttons on a card: the change as a diff, or the file at its line. */
export type OpenRequest = OpenDiff | OpenFile;

export type CloseTab = { type: "closeTab"; id: string };

export type FromWebview = { type: "ready" } | OpenRequest | CloseTab;
