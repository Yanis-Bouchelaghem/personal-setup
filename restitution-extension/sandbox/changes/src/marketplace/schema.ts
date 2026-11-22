export interface Plugin {
    name: string;
    version: string;
    archiveUrl: string;
    description?: string;
    homepage?: string;
}

const REQUIRED = ["name", "version", "archiveUrl"] as const;

export function parsePlugin(input: unknown): Plugin {
    if (typeof input !== "object" || input === null) {
        throw new Error("plugin must be an object");
    }
    const record = input as Record<string, unknown>;
    for (const key of REQUIRED) {
        if (typeof record[key] !== "string") {
            throw new Error(`plugin.${key} must be a string`);
        }
    }
    return record as unknown as Plugin;
}

export interface Catalog {
    plugins: Plugin[];
    skipped: number;
}

export function parseCatalog(input: unknown): Catalog {
    if (!Array.isArray(input)) {
        throw new Error("catalog must be an array");
    }
    const plugins: Plugin[] = [];
    let skipped = 0;
    for (const entry of input) {
        try {
            plugins.push(parsePlugin(entry));
        } catch {
            skipped += 1;
        }
    }
    return { plugins, skipped };
}
