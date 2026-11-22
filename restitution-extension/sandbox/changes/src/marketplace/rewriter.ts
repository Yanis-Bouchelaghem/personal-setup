import { type Catalog, parseCatalog, type Plugin } from "./schema.js";

export class MarketplaceRewriter {
    constructor(private readonly apigeeBase: string) {}

    withApigeeArchiveUrl(plugin: Plugin): Plugin {
        const archive = new URL(plugin.archiveUrl);
        return { ...plugin, archiveUrl: `${this.apigeeBase}${archive.pathname}` };
    }

    rewrite(input: unknown): Catalog {
        const catalog = parseCatalog(input);
        return {
            ...catalog,
            plugins: catalog.plugins.map((plugin) =>
                this.withApigeeArchiveUrl(plugin),
            ),
        };
    }
}
