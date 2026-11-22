import { randomBytes } from "node:crypto";
import { join } from "node:path";

/**
 * Where things live under `<gitRoot>/.restitution/`:
 *
 *   <id>.json          one restitution, shown as one tab (the agent's file)
 *   <id>.review.json   the human's Viewed state for that tab
 *   <id>.code.json     what each step's code was when it was explained (server;
 *                      the panel adds a baseline for steps it never saw)
 *   <id>.answers.json  the agent's answers to the reader's comments (server)
 *   archive/           closed tabs, with their review and code files
 */
const DIR = ".restitution";
const ARCHIVE = "archive";

/** The line that keeps the folder out of `git status`. */
export const EXCLUDE_ENTRY = `${DIR}/`;

export function restitutionDir(gitRoot: string): string {
    return join(gitRoot, DIR);
}

export function archiveDir(gitRoot: string): string {
    return join(restitutionDir(gitRoot), ARCHIVE);
}

export function tabFile(gitRoot: string, id: string): string {
    return join(restitutionDir(gitRoot), `${id}.json`);
}

export function reviewFile(gitRoot: string, id: string): string {
    return join(restitutionDir(gitRoot), `${id}.review.json`);
}

export function codeFile(gitRoot: string, id: string): string {
    return join(restitutionDir(gitRoot), `${id}.code.json`);
}

export function answersFile(gitRoot: string, id: string): string {
    return join(restitutionDir(gitRoot), `${id}.answers.json`);
}

export function archivedAnswersFile(gitRoot: string, id: string): string {
    return join(archiveDir(gitRoot), `${id}.answers.json`);
}

export function archivedCodeFile(gitRoot: string, id: string): string {
    return join(archiveDir(gitRoot), `${id}.code.json`);
}

export function archivedTabFile(gitRoot: string, id: string): string {
    return join(archiveDir(gitRoot), `${id}.json`);
}

export function archivedReviewFile(gitRoot: string, id: string): string {
    return join(archiveDir(gitRoot), `${id}.review.json`);
}

/** Ids become file names, so keep them plain. */
export function isTabId(id: string): boolean {
    return /^[a-z0-9][a-z0-9-]{0,63}$/i.test(id);
}

export function assertTabId(id: string): void {
    if (!isTabId(id)) {
        throw new Error(`Invalid restitution id: ${id}`);
    }
}

/** Unique, readable, and roughly sortable by creation time. */
export function newTabId(): string {
    return `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
}

/**
 * The tab ids among the names in a folder: `<id>.json`, but not dotfiles,
 * temporary files, review, code or answers files.
 */
export function tabIds(fileNames: string[]): string[] {
    return fileNames
        .filter((name) => name.endsWith(".json") && !name.startsWith("."))
        .filter(
            (name) =>
                !name.endsWith(".review.json") &&
                !name.endsWith(".code.json") &&
                !name.endsWith(".answers.json"),
        )
        .map((name) => name.slice(0, -".json".length))
        .filter(isTabId);
}
