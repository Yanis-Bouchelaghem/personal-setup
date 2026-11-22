export interface Plugin {
    name: string;
    version: string;
    archiveUrl: string;
    description: string;
    homepage: string;
}

export function parsePlugin(input: unknown): Plugin {
    if (typeof input !== "object" || input === null) {
        throw new Error("plugin must be an object");
    }
    const record = input as Record<string, unknown>;
    for (const key of ["name", "version", "archiveUrl", "description", "homepage"]) {
        if (typeof record[key] !== "string") {
            throw new Error(`plugin.${key} must be a string`);
        }
    }
    return record as unknown as Plugin;
}

export function parseCatalog(input: unknown): Plugin[] {
    if (!Array.isArray(input)) {
        throw new Error("catalog must be an array");
    }
    return input.map(parsePlugin);
}
