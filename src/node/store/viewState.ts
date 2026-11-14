import type { FileDiff } from "../../core/diff";
import { codeSnapshot } from "../../core/fingerprint";
import type { Tab, ViewState } from "../../core/messages";
import { readAllDiffs } from "../git";
import { countClosed } from "./archive";
import { writeCodeSnapshot } from "./code";
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
    const withBaselines = await Promise.all(
        tabs.map((tab) => addBaselines(gitRoot, tab, diffs)),
    );
    return { status: "ok", tabs: withBaselines, closed, diffs };
}

/**
 * Steps the code snapshot has never seen (a tab written before snapshots
 * existed, or by an older server) get today's code as their baseline, so a
 * later edit under them still shows as a change. Steps already in the
 * snapshot keep what the agent wrote them against.
 */
async function addBaselines(
    gitRoot: string,
    tab: Tab,
    diffs: Record<string, FileDiff>,
): Promise<Tab> {
    if (tab.kind !== "ok") {
        return tab;
    }
    const now = codeSnapshot(tab.restitution, diffs);
    const missing = Object.keys(now).filter((print) => !(print in tab.code));
    if (missing.length === 0) {
        return tab;
    }
    const code = { ...now, ...tab.code };
    await writeCodeSnapshot(gitRoot, tab.id, code).catch(() => undefined);
    return { ...tab, code };
}
