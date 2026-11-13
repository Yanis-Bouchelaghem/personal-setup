import { checkCoverage, describeSubmit } from "../core/coverage";
import type { Restitution } from "../core/restitution";
import { readAllDiffs } from "./git";
import { writeRestitution } from "./store";

/**
 * Save a restitution and say what is still off. Coverage problems are
 * reported, never raised: the explanation stays optional.
 */
export async function submitRestitution(
    gitRoot: string,
    restitution: Restitution,
): Promise<string> {
    await writeRestitution(gitRoot, restitution);
    const diffs = await readAllDiffs(gitRoot).catch(() => undefined);
    return describeSubmit(
        restitution,
        diffs && checkCoverage(restitution, diffs),
    );
}
