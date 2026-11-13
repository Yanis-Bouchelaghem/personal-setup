import { parseUnifiedDiff } from "../../core/diff";
import type { ViewState } from "../../core/messages";
import type { Restitution } from "../../core/restitution";

const many: Restitution = {
    version: 1,
    request: "/code-review --fix",
    goals: [
        {
            title: "Reject plain-http Apigee URLs",
            ref: "#1",
            steps: [
                {
                    file: "src/config.ts",
                    why: "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text.",
                },
                {
                    file: "test/config.test.ts",
                    why: "Pin the startup failure for http URLs, to catch a regression early.",
                },
            ],
        },
        {
            title: "Stop sending two Authorization headers",
            ref: "#2",
            steps: [
                {
                    file: "src/gateway/btapGatewayClient.ts",
                    why: "Set Authorization through Headers, because a plain object kept both casings.",
                },
                {
                    file: "test/gateway/btapGatewayClient.test.ts",
                    why: "Assert a single header goes out, to prove the casing clash is gone.",
                },
            ],
        },
        {
            title: "One bad plugin must not block the catalog",
            ref: "#4",
            steps: [
                {
                    file: "src/marketplace/marketplaceSchema.ts",
                    why: "Loosen the plugin schema, so one malformed entry no longer fails the parse.",
                },
                {
                    file: "src/marketplace/marketplaceRewriter.ts",
                    lines: [10, 24],
                    why: "Check each plugin on its own, to drop only the bad ones.",
                    because:
                        "Needs the looser schema first, otherwise every plugin is still rejected up front.",
                },
                {
                    file: "test/marketplace/marketplace.test.ts",
                    why: "Serve a catalog with one broken plugin, to prove the rest survives.",
                },
            ],
        },
        {
            title: "Keep the swagger file in sync",
            steps: [
                {
                    file: "src/swagger.js",
                    why: "Describe the https-only setting, so the docs match the new behaviour.",
                },
            ],
        },
    ],
};

const long: Restitution = {
    version: 1,
    goals: [
        {
            title: "A goal with a very long title that has to wrap onto a second line without breaking the layout",
            steps: [
                {
                    file: "src/some/deeply/nested/folder/structure/that/keeps/going/andGoing.ts",
                    why: "Rename the helper everywhere, so the intent reads the same in every call site and in every test that exercises it afterwards.",
                    because:
                        "The earlier step moved the logic here, which is why this one has to follow it directly.",
                },
            ],
        },
    ],
};

const SAMPLE_DIFFS = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -41,7 +41,12 @@ function readApigeeUrl() {
   const raw = process.env.ADAPTER_APIGEE_URL;
   if (!raw) {
     throw new Error("ADAPTER_APIGEE_URL is required");
   }
-  return new URL(raw);
+  const url = new URL(raw);
+  if (url.protocol !== "https:") {
+    throw new Error("ADAPTER_APIGEE_URL must use https");
+  }
+  return url;
 }
diff --git a/test/config.test.ts b/test/config.test.ts
new file mode 100644
--- /dev/null
+++ b/test/config.test.ts
@@ -0,0 +1,9 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import { readApigeeUrl } from "../src/config.js";
+
+test("rejects a plain-http Apigee URL", () => {
+  process.env.ADAPTER_APIGEE_URL = "http://apigee.example.com";
+  assert.throws(() => readApigeeUrl(), /must use https/);
+});
diff --git a/src/gateway/btapGatewayClient.ts b/src/gateway/btapGatewayClient.ts
--- a/src/gateway/btapGatewayClient.ts
+++ b/src/gateway/btapGatewayClient.ts
@@ -22,9 +22,8 @@ export class BtapGatewayClient {
   async request(path: string, init: RequestInit = {}) {
-    const headers = {
-      ...init.headers,
-      Authorization: \`Bearer \${await this.token()}\`,
-    };
+    const headers = new Headers(init.headers);
+    headers.set("Authorization", \`Bearer \${await this.token()}\`);
     return fetch(this.url(path), { ...init, headers });
   }
diff --git a/src/marketplace/marketplaceRewriter.ts b/src/marketplace/marketplaceRewriter.ts
--- a/src/marketplace/marketplaceRewriter.ts
+++ b/src/marketplace/marketplaceRewriter.ts
@@ -9,8 +9,16 @@ export class MarketplaceRewriter {
   rewrite(catalog: Catalog): Catalog {
-    return catalog.plugins.map((plugin) => this.withApigeeArchiveUrl(plugin));
+    const plugins = [];
+    for (const plugin of catalog.plugins) {
+      const parsed = PluginSchema.safeParse(plugin);
+      if (!parsed.success) {
+        continue;
+      }
+      plugins.push(this.withApigeeArchiveUrl(parsed.data));
+    }
+    return { ...catalog, plugins };
   }
`;

const diffs = Object.fromEntries(
    parseUnifiedDiff(SAMPLE_DIFFS).map((diff) => [diff.file, diff]),
);

const ago = (minutes: number) => Date.now() - minutes * 60_000;

const small: Restitution = {
    version: 1,
    label: "Request id header",
    request: "Add an X-Request-Id header",
    goals: [
        {
            title: "Send X-Request-Id with every gateway call",
            steps: [
                {
                    file: "src/gateway/btapGatewayClient.ts",
                    why: "Add a random X-Request-Id, so each call can be traced.",
                },
            ],
        },
    ],
};

export const fixtures: Record<string, ViewState> = {
    many: {
        status: "ok",
        tabs: [
            {
                kind: "ok",
                id: "a1",
                label: "Review fixes",
                updatedAt: ago(1),
                restitution: { ...many, label: "Review fixes" },
            },
            {
                kind: "ok",
                id: "b2",
                label: "Request id header",
                updatedAt: ago(35),
                restitution: small,
            },
            {
                kind: "error",
                id: "c3",
                label: "c3",
                updatedAt: ago(300),
                errors: [
                    "goals.0.steps: Too small: expected array to have >=1 items",
                ],
            },
        ],
        diffs,
    },
    one: {
        status: "ok",
        tabs: [
            {
                kind: "ok",
                id: "a1",
                label: "Review fixes",
                updatedAt: ago(1),
                restitution: { ...many, label: "Review fixes" },
            },
        ],
        diffs,
    },
    long: {
        status: "ok",
        tabs: [
            {
                kind: "ok",
                id: "l1",
                label: "A tab label that is much too long to fit in the strip",
                updatedAt: ago(2),
                restitution: long,
            },
            {
                kind: "ok",
                id: "l2",
                label: "Second",
                updatedAt: ago(9),
                restitution: small,
            },
        ],
        diffs: {},
    },
    empty: { status: "empty" },
    norepo: { status: "no-repo" },
    error: {
        status: "error",
        errors: [
            "goals.0.steps.0.why: Too small: expected string to have >=1 characters",
            "version: Invalid input: expected 1",
        ],
    },
};
