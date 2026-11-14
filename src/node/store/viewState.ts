import type { ViewState } from "../../core/messages";
import { readAllDiffs } from "../git";
import { countClosed } from "./archive";
import { readTabs } from "./tabs";

/** What the panel shows: every tab, plus the diffs of every uncommitted change. */
export async function readViewState(gitRoot: string): Promise<ViewState> {
    const [tabs, closed] = await Promise.all([
        readTabs(gitRoot),
        countClosed(gitRoot),
    ]);
    if (tabs.length === 0) {
        return { status: "empty", closed };
    }
    // Every uncommitted change, not only what the steps point at: the panel
    // also shows what no guide covers. A git hiccup must not hide the
    // explanations: show them without hunks.
    const diffs = await readAllDiffs(gitRoot).catch(() => ({}));
    return { status: "ok", tabs, closed, diffs };
}
