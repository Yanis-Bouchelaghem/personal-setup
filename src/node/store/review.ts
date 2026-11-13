import { readFile } from "node:fs/promises";

import { parseViewed, serializeReview, withViewed } from "../../core/review";
import { writeAtomically } from "./files";
import { assertTabId, reviewFile } from "./paths";

/** The fingerprints of the steps marked Viewed; none if there is no file. */
export async function readViewed(
    gitRoot: string,
    id: string,
): Promise<string[]> {
    return parseViewed(
        await readFile(reviewFile(gitRoot, id), "utf8").catch(() => ""),
    );
}

/** Mark a step Viewed (or not). Only the extension writes this file. */
export async function setViewed(
    gitRoot: string,
    id: string,
    fingerprint: string,
    on: boolean,
): Promise<void> {
    assertTabId(id);
    const viewed = withViewed(await readViewed(gitRoot, id), fingerprint, on);
    await writeAtomically(reviewFile(gitRoot, id), serializeReview(viewed));
}
