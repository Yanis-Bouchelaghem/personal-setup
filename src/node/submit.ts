import { checkCoverage, describeSubmit } from "../core/coverage";
import type { Restitution } from "../core/restitution";
import { readAllDiffs } from "./git";
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
        const [diffs, tabs] = await Promise.all([
            readAllDiffs(gitRoot),
            readTabs(gitRoot),
        ]);
        const others = tabs.flatMap((tab) =>
            tab.kind === "ok" && tab.id !== id ? [tab.restitution] : [],
        );
        return describeSubmit(
            restitution,
            checkCoverage(restitution, diffs, others),
        );
    } catch {
        return describeSubmit(restitution, undefined);
    }
}
