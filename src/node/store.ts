import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
    mkdir,
    readdir,
    readFile,
    rename,
    stat,
    writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { Tab, ViewState } from "../core/messages";
import {
    parseRestitution,
    type Restitution,
    tabLabel,
} from "../core/restitution";
import { parseViewed, serializeReview, withViewed } from "../core/review";
import { readDiffs } from "./git";

const run = promisify(execFile);
const DIR = ".restitution";
const ARCHIVE = "archive";

export function restitutionDir(gitRoot: string): string {
    return join(gitRoot, DIR);
}

function isNotFound(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Ids become file names, so keep them plain. */
export function isTabId(id: string): boolean {
    return /^[a-z0-9][a-z0-9-]{0,63}$/i.test(id);
}

/** Unique, readable, and roughly sortable by creation time. */
export function newTabId(): string {
    return `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
}

/** `<id>.json` files; dotfiles, temporary files and review sidecars are not tabs. */
function tabIds(fileNames: string[]): string[] {
    return fileNames
        .filter((name) => name.endsWith(".json") && !name.startsWith("."))
        .filter((name) => !name.endsWith(".review.json"))
        .map((name) => name.slice(0, -".json".length))
        .filter(isTabId);
}

function reviewFile(gitRoot: string, id: string): string {
    return join(restitutionDir(gitRoot), `${id}.review.json`);
}

async function readViewed(gitRoot: string, id: string): Promise<string[]> {
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
    if (!isTabId(id)) {
        throw new Error(`Invalid restitution id: ${id}`);
    }
    const file = reviewFile(gitRoot, id);
    const viewed = withViewed(await readViewed(gitRoot, id), fingerprint, on);
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, serializeReview(viewed));
    await rename(temporary, file);
}

/** Move the review sidecar along with its restitution, if there is one. */
async function moveReview(from: string, to: string): Promise<void> {
    await rename(from, to).catch((error) => {
        if (!isNotFound(error)) {
            throw error;
        }
    });
}

async function readTab(gitRoot: string, id: string): Promise<Tab | undefined> {
    const file = join(restitutionDir(gitRoot), `${id}.json`);
    try {
        const [text, info] = await Promise.all([
            readFile(file, "utf8"),
            stat(file),
        ]);
        const updatedAt = info.mtimeMs;
        const parsed = parseRestitution(text);
        return parsed.ok
            ? {
                  kind: "ok",
                  id,
                  label: tabLabel(parsed.value),
                  updatedAt,
                  restitution: parsed.value,
                  viewed: await readViewed(gitRoot, id),
              }
            : {
                  kind: "error",
                  id,
                  label: id,
                  updatedAt,
                  errors: parsed.errors,
              };
    } catch (error) {
        if (isNotFound(error)) {
            return undefined; // archived or replaced while we were reading
        }
        throw error;
    }
}

/** Every restitution in the repo, newest first. */
export async function readTabs(gitRoot: string): Promise<Tab[]> {
    const names = await readdir(restitutionDir(gitRoot)).catch((error) => {
        if (isNotFound(error)) {
            return [];
        }
        throw error;
    });
    const tabs = await Promise.all(
        tabIds(names).map((id) => readTab(gitRoot, id)),
    );
    return tabs
        .filter((tab) => tab !== undefined)
        .toSorted(
            (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
        );
}

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

/**
 * Create `.restitution/` and keep it out of `git status` through
 * `info/exclude`, which works in worktrees and never touches .gitignore.
 */
export async function ensureRestitutionDir(gitRoot: string): Promise<void> {
    await mkdir(restitutionDir(gitRoot), { recursive: true });
    const { stdout } = await run("git", [
        "-C",
        gitRoot,
        "rev-parse",
        "--git-path",
        "info/exclude",
    ]);
    const excludeFile = resolve(gitRoot, stdout.trim());
    const entry = `${DIR}/`;
    const current = await readFile(excludeFile, "utf8").catch(() => "");
    if (current.split("\n").includes(entry)) {
        return;
    }
    await mkdir(dirname(excludeFile), { recursive: true });
    const separator = current === "" || current.endsWith("\n") ? "" : "\n";
    await writeFile(excludeFile, `${current}${separator}${entry}\n`);
}

/** Write one restitution atomically, so a watcher never reads half a file. */
export async function writeRestitution(
    gitRoot: string,
    id: string,
    restitution: Restitution,
): Promise<void> {
    if (!isTabId(id)) {
        throw new Error(`Invalid restitution id: ${id}`);
    }
    await ensureRestitutionDir(gitRoot);
    const target = join(restitutionDir(gitRoot), `${id}.json`);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(restitution, null, 4)}\n`);
    await rename(temporary, target);
}

/** Close a tab: move its file to `.restitution/archive/`, so it can come back. */
export async function archiveTab(gitRoot: string, id: string): Promise<void> {
    if (!isTabId(id)) {
        throw new Error(`Invalid restitution id: ${id}`);
    }
    const archive = join(restitutionDir(gitRoot), ARCHIVE);
    await mkdir(archive, { recursive: true });
    await rename(
        join(restitutionDir(gitRoot), `${id}.json`),
        join(archive, `${id}.json`),
    );
    await moveReview(
        reviewFile(gitRoot, id),
        join(archive, `${id}.review.json`),
    );
}

async function closedNames(gitRoot: string): Promise<string[]> {
    return readdir(join(restitutionDir(gitRoot), ARCHIVE)).catch((error) => {
        if (isNotFound(error)) {
            return [];
        }
        throw error;
    });
}

export async function countClosed(gitRoot: string): Promise<number> {
    return tabIds(await closedNames(gitRoot)).length;
}

export type ClosedTab = { id: string; label: string; closedAt: number };

/**
 * Closed tabs, most recently closed first. Moving a file changes its ctime
 * but not its mtime, so ctime is when it was closed.
 */
export async function readClosedTabs(gitRoot: string): Promise<ClosedTab[]> {
    const folder = join(restitutionDir(gitRoot), ARCHIVE);
    const tabs = await Promise.all(
        tabIds(await closedNames(gitRoot)).map(async (id) => {
            const file = join(folder, `${id}.json`);
            try {
                const [text, info] = await Promise.all([
                    readFile(file, "utf8"),
                    stat(file),
                ]);
                const parsed = parseRestitution(text);
                const label = parsed.ok ? tabLabel(parsed.value) : id;
                return { id, label, closedAt: info.ctimeMs };
            } catch (error) {
                if (isNotFound(error)) {
                    return undefined;
                }
                throw error;
            }
        }),
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
    if (!isTabId(id)) {
        throw new Error(`Invalid restitution id: ${id}`);
    }
    const folder = restitutionDir(gitRoot);
    const taken = new Set(tabIds(await readdir(folder)));
    let target = id;
    for (let n = 2; taken.has(target); n++) {
        target = `${id}-${n}`;
    }
    await rename(
        join(folder, ARCHIVE, `${id}.json`),
        join(folder, `${target}.json`),
    );
    await moveReview(
        join(folder, ARCHIVE, `${id}.review.json`),
        reviewFile(gitRoot, target),
    );
    return target;
}
