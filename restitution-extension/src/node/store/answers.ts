import { readFile } from "node:fs/promises";

import {
    type Answer,
    parseAnswers,
    serializeAnswers,
} from "../../core/answers";
import { orMissing, writeAtomically } from "./files";
import { answersFile, assertTabId } from "./paths";

/** The agent's answers on a tab; none if there is no file. */
export async function readAnswers(
    gitRoot: string,
    id: string,
): Promise<Answer[]> {
    const text = await orMissing(() =>
        readFile(answersFile(gitRoot, id), "utf8"),
    );
    return text === undefined ? [] : parseAnswers(text);
}

/** Add answers to a tab. Only the MCP server writes this file. */
export async function addAnswers(
    gitRoot: string,
    id: string,
    answers: readonly Answer[],
): Promise<void> {
    assertTabId(id);
    const existing = await readAnswers(gitRoot, id);
    await writeAtomically(
        answersFile(gitRoot, id),
        serializeAnswers([...existing, ...answers]),
    );
}
