import { readdir, rename, writeFile } from "node:fs/promises";

function isNotFound(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Run `read`; a file that is not there (any more) gives `undefined`. */
export async function orMissing<T>(
    read: () => Promise<T>,
): Promise<T | undefined> {
    try {
        return await read();
    } catch (error) {
        if (isNotFound(error)) {
            return undefined;
        }
        throw error;
    }
}

/** The names in a folder; a folder that does not exist is empty. */
export async function listNames(folder: string): Promise<string[]> {
    return (await orMissing(() => readdir(folder))) ?? [];
}

/** Move a file; if it is not there, there is nothing to move. */
export async function moveIfExists(from: string, to: string): Promise<void> {
    await orMissing(() => rename(from, to));
}

/** Write through a temporary file, so a reader never sees half of it. */
export async function writeAtomically(
    file: string,
    text: string,
): Promise<void> {
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, text);
    await rename(temporary, file);
}
