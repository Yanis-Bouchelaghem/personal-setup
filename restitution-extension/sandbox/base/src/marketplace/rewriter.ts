import { parseCatalog, type Plugin } from "./schema.js";

export class MarketplaceRewriter {
    constructor(private readonly apigeeBase: string) {}

    withApigeeArchiveUrl(plugin: Plugin): Plugin {
        const archive = new URL(plugin.archiveUrl);
        return { ...plugin, archiveUrl: `${this.apigeeBase}${archive.pathname}` };
    }

    rewrite(input: unknown): Plugin[] {
        return parseCatalog(input).map((plugin) => this.withApigeeArchiveUrl(plugin));
    }
}
