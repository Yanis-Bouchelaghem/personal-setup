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
    const { plugins } = rewriter.rewrite([plugin("a")]);
    assert.equal(plugins[0]?.archiveUrl, "https://apigee.example.com/acme/a/archive.zip");
});

test("one malformed plugin does not block the rest", () => {
    const rewriter = new MarketplaceRewriter("https://apigee.example.com");
    const { plugins, skipped } = rewriter.rewrite([
        plugin("a"),
        { name: "broken" },
        plugin("c"),
    ]);
    assert.deepEqual(
        plugins.map((entry) => entry.name),
        ["a", "c"],
    );
    assert.equal(skipped, 1);
});
