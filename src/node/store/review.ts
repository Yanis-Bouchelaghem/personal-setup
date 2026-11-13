import { readFile } from "node:fs/promises";

import {
    applyReviewAction,
    parseReview,
    type Review,
    type ReviewAction,
    serializeReview,
} from "../../core/review";
import { writeAtomically } from "./files";
import { assertTabId, reviewFile } from "./paths";

/** The human's review of a tab; an empty one if there is no file. */
export async function readReview(gitRoot: string, id: string): Promise<Review> {
    return parseReview(
        await readFile(reviewFile(gitRoot, id), "utf8").catch(() => ""),
    );
}

/** Apply one change to a tab's review. Only the extension writes this file. */
export async function updateReview(
    gitRoot: string,
    id: string,
    action: ReviewAction,
): Promise<void> {
    assertTabId(id);
    const review = applyReviewAction(await readReview(gitRoot, id), action);
    await writeAtomically(reviewFile(gitRoot, id), serializeReview(review));
}
