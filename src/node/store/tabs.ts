import { readFile, stat } from "node:fs/promises";

import { type Answer, isAnswered } from "../../core/answers";
import type { Tab } from "../../core/messages";
import {
    parseRestitution,
    type Restitution,
    tabLabel,
} from "../../core/restitution";
import { pendingRequests, type ReviewRequest } from "../../core/review";
import { readAnswers } from "./answers";
import { readCodeSnapshot } from "./code";
import { ensureRestitutionDir } from "./exclude";
import { listNames, orMissing, writeAtomically } from "./files";
import { assertTabId, restitutionDir, tabFile, tabIds } from "./paths";
import { readReview } from "./review";

async function readTab(gitRoot: string, id: string): Promise<Tab | undefined> {
    const file = tabFile(gitRoot, id);
    // The file can be archived or replaced while we are reading it.
    return orMissing(async () => {
        const [text, info] = await Promise.all([
            readFile(file, "utf8"),
            stat(file),
        ]);
        const updatedAt = info.mtimeMs;
        const parsed = parseRestitution(text);
        if (!parsed.ok) {
            return {
                kind: "error",
                id,
                label: id,
                updatedAt,
                errors: parsed.errors,
            } satisfies Tab;
        }
        const [review, code, answers] = await Promise.all([
            readReview(gitRoot, id),
            readCodeSnapshot(gitRoot, id),
            readAnswers(gitRoot, id),
        ]);
        return {
            kind: "ok",
            id,
            label: tabLabel(parsed.value),
            updatedAt,
            restitution: parsed.value,
            viewed: review.viewed,
            ...(review.known ? { known: review.known } : {}),
            requests: openRequests(pendingRequests(review, updatedAt), answers),
            code,
            answers,
            resolved: review.resolved,
        } satisfies Tab;
    });
}

/**
 * An answered comment moves to its answer, under which the reader sees it;
 * a "clarify" sent with it stays open until the agent rewrites the step.
 */
function openRequests(
    requests: ReviewRequest[],
    answers: Answer[],
): ReviewRequest[] {
    return requests.flatMap((request) => {
        if (!isAnswered(request, answers)) {
            return [request];
        }
        return request.clarify ? [{ ...request, comment: undefined }] : [];
    });
}

/** Every restitution in the repo, newest first. */
export async function readTabs(gitRoot: string): Promise<Tab[]> {
    const names = await listNames(restitutionDir(gitRoot));
    const tabs = await Promise.all(
        tabIds(names).map((id) => readTab(gitRoot, id)),
    );
    return tabs
        .filter((tab) => tab !== undefined)
        .toSorted(
            (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
        );
}

/** Write one restitution, replacing the tab with the same id. */
export async function writeRestitution(
    gitRoot: string,
    id: string,
    restitution: Restitution,
): Promise<void> {
    assertTabId(id);
    await ensureRestitutionDir(gitRoot);
    await writeAtomically(
        tabFile(gitRoot, id),
        `${JSON.stringify(restitution, null, 4)}\n`,
    );
}
