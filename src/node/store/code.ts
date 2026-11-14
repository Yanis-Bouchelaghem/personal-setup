import { readFile } from "node:fs/promises";

import * as z from "zod";

import { orMissing, writeAtomically } from "./files";
import { assertTabId, codeFile } from "./paths";

const SnapshotSchema = z.record(z.string(), z.string());

/**
 * What each step's code was when its explanation was written, keyed by step
 * fingerprint. Written by the MCP server on every submit and edit.
 */
export async function readCodeSnapshot(
    gitRoot: string,
    id: string,
): Promise<Record<string, string>> {
    const text = await orMissing(() => readFile(codeFile(gitRoot, id), "utf8"));
    if (text === undefined) {
        return {};
    }
    try {
        const parsed = SnapshotSchema.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data : {};
    } catch {
        return {};
    }
}

export async function writeCodeSnapshot(
    gitRoot: string,
    id: string,
    snapshot: Record<string, string>,
): Promise<void> {
    assertTabId(id);
    await writeAtomically(
        codeFile(gitRoot, id),
        `${JSON.stringify(snapshot, null, 2)}\n`,
    );
}
