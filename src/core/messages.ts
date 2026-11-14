import type { FileDiff, LineRange } from "./diff";
import type { Restitution } from "./restitution";
import type { ReviewAction, ReviewRequest } from "./review";

/** One restitution file, shown as a tab. A broken file only breaks its own tab. */
export type Tab =
    | {
          kind: "ok";
          id: string;
          label: string;
          updatedAt: number;
          restitution: Restitution;
          /** Steps marked Viewed (by fingerprint): folded to their header. */
          viewed: string[];
          /** Steps the reader was already shown; absent before the first look. */
          known?: string[];
          /** What the reader asks the agent, still open. */
          requests: ReviewRequest[];
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
    /** No git repository; `folder` is the open folder, if any. */
    | { status: "no-repo"; folder?: string }
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

/** Open a step's change as a diff (both sides exist), selecting `ranges` on the file side. */
export type OpenDiff = {
    type: "openDiff";
    file: string;
    ranges: LineRange[];
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

/** Change the reader's review of a tab: Viewed, known steps, requests. */
export type ReviewMessage = {
    type: "review";
    tabId: string;
    action: ReviewAction;
};

/** Copy the feedback prompt for the agent, and mark the requests as sent. */
export type CopyFeedback = {
    type: "copyFeedback";
    tabId: string;
    text: string;
};

export type FromWebview =
    | { type: "ready" }
    | OpenRequest
    | CloseTab
    | ReopenTab
    | ReviewMessage
    | CopyFeedback
    | { type: "initRepo" }
    /** Open a documentation link in the browser. */
    | { type: "openUrl"; url: string };
