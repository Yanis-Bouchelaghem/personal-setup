import type { FileDiff, LineRange } from "./diff";
import type { Restitution } from "./restitution";

/** One restitution file, shown as a tab. A broken file only breaks its own tab. */
export type Tab =
    | {
          kind: "ok";
          id: string;
          label: string;
          updatedAt: number;
          restitution: Restitution;
          /** Fingerprints of the steps the human marked Viewed. */
          viewed: string[];
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
    | { status: "empty"; closed: number }
    | { status: "error"; errors: string[] }
    | {
          status: "ok";
          /** Newest first. */
          tabs: Tab[];
          /** How many closed tabs could be reopened. */
          closed: number;
          /** Working-tree diffs for the files any step points at, by path. */
          diffs: Record<string, FileDiff>;
      };

export type ToWebview =
    | { type: "state"; state: ViewState }
    /** Switch to this tab (after reopening it). */
    | { type: "select"; id: string };

/** Open a step's change as a diff, selecting `ranges` on the file side. */
export type OpenDiff = {
    type: "openDiff";
    file: string;
    ranges: LineRange[];
    status?: FileDiff["status"];
};

/** Open the file itself, selecting `ranges`. */
export type OpenFile = {
    type: "openFile";
    file: string;
    ranges: LineRange[];
};

/** Both buttons on a card: the change as a diff, or the file at its line. */
export type OpenRequest = OpenDiff | OpenFile;

export type CloseTab = { type: "closeTab"; id: string };

export type ReopenTab = { type: "reopenTab" };

export type SetViewed = {
    type: "setViewed";
    tabId: string;
    fingerprint: string;
    viewed: boolean;
};

/** Put text on the clipboard: the Clarify prompt, to paste to an agent. */
export type CopyPrompt = { type: "copyPrompt"; text: string };

export type FromWebview =
    | { type: "ready" }
    | OpenRequest
    | CloseTab
    | ReopenTab
    | SetViewed
    | CopyPrompt;
