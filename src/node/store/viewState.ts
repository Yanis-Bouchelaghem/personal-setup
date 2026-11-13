import type { ViewState } from "../../core/messages";
import { readDiffs } from "../git";
import { countClosed } from "./archive";
import { readTabs } from "./tabs";

/** What the panel shows: every tab, plus the diffs their steps point at. */
export async function readViewState(gitRoot: string): Promise<ViewState> {
    const [tabs, closed] = await Promise.all([
        readTabs(gitRoot),
        countClosed(gitRoot),
    ]);
    if (tabs.length === 0) {
        return { status: "empty", closed };
    }
    const files = tabs.flatMap((tab) =>
        tab.kind === "ok"
            ? tab.restitution.goals.flatMap((goal) =>
                  goal.steps.flatMap((step) => (step.file ? [step.file] : [])),
              )
            : [],
    );
    // A git hiccup must not hide the explanations: show them without hunks.
    const diffs = await readDiffs(gitRoot, files).catch(() => ({}));
    return { status: "ok", tabs, closed, diffs };
}
