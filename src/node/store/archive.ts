import { mkdir, readFile, stat } from "node:fs/promises";

import { parseRestitution, tabLabel } from "../../core/restitution";
import { listNames, moveIfExists, orMissing } from "./files";
import {
    archiveDir,
    archivedReviewFile,
    archivedTabFile,
    assertTabId,
    restitutionDir,
    reviewFile,
    tabFile,
    tabIds,
} from "./paths";

/** Close a tab: move its files to `.restitution/archive/`, so it can come back. */
export async function archiveTab(gitRoot: string, id: string): Promise<void> {
    assertTabId(id);
    await mkdir(archiveDir(gitRoot), { recursive: true });
    await moveIfExists(tabFile(gitRoot, id), archivedTabFile(gitRoot, id));
    await moveIfExists(
        reviewFile(gitRoot, id),
        archivedReviewFile(gitRoot, id),
    );
}

export async function countClosed(gitRoot: string): Promise<number> {
    return tabIds(await listNames(archiveDir(gitRoot))).length;
}

export type ClosedTab = { id: string; label: string; closedAt: number };

/**
 * Closed tabs, most recently closed first. Moving a file changes its ctime
 * but not its mtime, so ctime is when it was closed.
 */
export async function readClosedTabs(gitRoot: string): Promise<ClosedTab[]> {
    const ids = tabIds(await listNames(archiveDir(gitRoot)));
    const tabs = await Promise.all(
        ids.map((id) =>
            orMissing(async () => {
                const file = archivedTabFile(gitRoot, id);
                const [text, info] = await Promise.all([
                    readFile(file, "utf8"),
                    stat(file),
                ]);
                const parsed = parseRestitution(text);
                return {
                    id,
                    label: parsed.ok ? tabLabel(parsed.value) : id,
                    closedAt: info.ctimeMs,
                };
            }),
        ),
    );
    return tabs
        .filter((tab) => tab !== undefined)
        .toSorted((a, b) => b.closedAt - a.closedAt);
}

/**
 * Bring a closed tab back. If the agent has since written a new file with the
 * same id, the old one comes back under a free id instead of replacing it.
 */
export async function restoreTab(gitRoot: string, id: string): Promise<string> {
    assertTabId(id);
    const taken = new Set(tabIds(await listNames(restitutionDir(gitRoot))));
    let target = id;
    for (let n = 2; taken.has(target); n++) {
        target = `${id}-${n}`;
    }
    await moveIfExists(archivedTabFile(gitRoot, id), tabFile(gitRoot, target));
    await moveIfExists(
        archivedReviewFile(gitRoot, id),
        reviewFile(gitRoot, target),
    );
    return target;
}
