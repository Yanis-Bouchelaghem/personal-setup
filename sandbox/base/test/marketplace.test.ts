import assert from "node:assert/strict";
import test from "node:test";

import { MarketplaceRewriter } from "../src/marketplace/rewriter.js";

const plugin = (name: string) => ({
    name,
    version: "1.0.0",
    archiveUrl: `https://github.com/acme/${name}/archive.zip`,
    description: "A plugin",
    homepage: "https://example.com",
});

test("rewrites archive urls through Apigee", () => {
    const rewriter = new MarketplaceRewriter("https://apigee.example.com");
    const [first] = rewriter.rewrite([plugin("a")]);
    assert.equal(first?.archiveUrl, "https://apigee.example.com/acme/a/archive.zip");
});
