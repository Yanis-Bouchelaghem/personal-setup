import { checkCoverage, describeSubmit } from "../core/coverage";
import { codeSnapshot, staleLabels } from "../core/fingerprint";
import type { Restitution } from "../core/restitution";
import { readAllDiffs } from "./git";
import { readCodeSnapshot, writeCodeSnapshot } from "./store/code";
import { readTabs, writeRestitution } from "./store/tabs";

/**
 * Save a restitution as the tab `id` and say what is still off. Coverage
 * problems are reported, never raised: the explanation stays optional.
 */
export async function submitRestitution(
    gitRoot: string,
    id: string,
    restitution: Restitution,
): Promise<string> {
    await writeRestitution(gitRoot, id, restitution);
    try {
        const [diffs, tabs, written] = await Promise.all([
            readAllDiffs(gitRoot),
            readTabs(gitRoot),
            readCodeSnapshot(gitRoot, id),
        ]);
        const others = tabs.flatMap((tab) =>
            tab.kind === "ok" && tab.id !== id ? [tab.restitution] : [],
        );
        // Steps kept as they were whose code changed since: worth a look.
        // Then this submission becomes what the guide was written against.
        const stale = staleLabels(restitution, diffs, written);
        await writeCodeSnapshot(gitRoot, id, codeSnapshot(restitution, diffs));
        return describeSubmit(
            restitution,
            checkCoverage(restitution, diffs, others),
            stale,
        );
    } catch {
        return describeSubmit(restitution, undefined);
    }
}
