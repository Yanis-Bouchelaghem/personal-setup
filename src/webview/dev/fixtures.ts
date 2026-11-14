import { parseUnifiedDiff } from "../../core/diff";
import { goalFingerprints } from "../../core/fingerprint";
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
                    lines: [[41, 52]],
                    why: "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text.",
                },
                {
                    link: "which means",
                    why: "any environment still set to an http:// URL now fails at startup, and must switch before this ships.",
                },
                {
                    file: "src/swagger.js",
                    lines: [[1, 6]],
                    link: "so",
                    why: "say in the API description that the URL must be https, so operators switch first.",
                },
                {
                    file: "test/config.test.ts",
                    lines: [[1, 9]],
                    link: "then",
                    why: "write the test that rejects an http URL, to catch a regression early.",
                },
            ],
        },
        {
            title: "Stop sending two Authorization headers",
            ref: "#2",
            steps: [
                {
                    file: "src/gateway/btapGatewayClient.ts",
                    lines: [[22, 29]],
                    why: "Set Authorization through Headers, because a plain object kept both casings.",
                },
                {
                    file: "test/gateway/btapGatewayClient.test.ts",
                    lines: [[1, 12]],
                    link: "then",
                    why: "assert that a single header goes out, to prove the casing clash is gone.",
                },
            ],
        },
        {
            title: "One bad plugin must not block the catalog",
            ref: "#4",
            steps: [
                {
                    file: "src/marketplace/marketplaceSchema.ts",
                    lines: [[1, 20]],
                    why: "Parse each plugin on its own, so one bad entry can't fail the catalog.",
                    examples: [
                        {
                            title: "An example of a catalog the marketplace API could return, with one broken plugin",
                            body: '[\n  {\n    "name": "lint-helper",\n    "version": "1.4.0",\n    "archiveUrl": "https://plugins.example.com/lint-helper-1.4.0.tgz",\n    "description": "Runs the team\'s lint rules"\n  },\n  { "name": "broken-plugin", "version": 2 },\n  …\n]',
                        },
                    ],
                },
                {
                    file: "src/marketplace/marketplaceRewriter.ts",
                    lines: [[10, 24]],
                    link: "then",
                    why: "rewrite only the plugins that parsed, and keep the skipped count.",
                },
                {
                    file: "test/marketplace/marketplace.test.ts",
                    lines: [[1, 12]],
                    link: "then",
                    why: "write the unit tests to cover what was added, with one broken plugin among good ones.",
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
                    lines: [[1, 3]],
                    why: "Rename the helper everywhere, so the intent reads the same in every call site and in every test that exercises it afterwards.",
                },
                {
                    file: "src/some/other/deeply/nested/folder/structure/that/keeps/going/andGoingToo.ts",
                    lines: [[1, 3]],
                    link: "in parallel",
                    why: "update the second module the same way, which does not depend on the first.",
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

// The review on the main fixture: 1.4 viewed (folded), 3.2 just updated by
// the agent, 2.1 marked to clarify with a comment, and a question on 3.3.
const PRINTS = goalFingerprints(many, diffs);
const print = (goal: number, step: number) => PRINTS[goal]?.[step] ?? "";
const REVIEW = {
    viewed: [print(0, 3)],
    known: PRINTS.flat().filter((fingerprint) => fingerprint !== print(2, 1)),
    requests: [
        {
            step: print(1, 0),
            label: "2.1",
            clarify: true,
            comment: "Why not keep the plain object and lowercase the key?",
        },
        {
            step: print(2, 2),
            label: "3.3",
            clarify: false,
            comment: "Does this cover a plugin with no version at all?",
        },
    ],
};

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
                    lines: [[22, 29]],
                    why: "Add a random X-Request-Id, so each call can be traced.",
                },
            ],
        },
    ],
};

export const fixtures: Record<string, ViewState> = {
    many: {
        status: "ok",
        closed: 2,
        tabs: [
            {
                kind: "ok",
                id: "a1",
                label: "Review fixes",
                updatedAt: ago(1),
                restitution: { ...many, label: "Review fixes" },
                ...REVIEW,
            },
            {
                kind: "ok",
                id: "b2",
                label: "Request id header",
                updatedAt: ago(35),
                restitution: small,
                viewed: [],
                requests: [],
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
        closed: 0,
        tabs: [
            {
                kind: "ok",
                id: "a1",
                label: "Review fixes",
                updatedAt: ago(1),
                restitution: { ...many, label: "Review fixes" },
                ...REVIEW,
            },
        ],
        diffs,
    },
    long: {
        status: "ok",
        closed: 0,
        tabs: [
            {
                kind: "ok",
                id: "l1",
                label: "A tab label that is much too long to fit in the strip",
                updatedAt: ago(2),
                restitution: long,
                viewed: [],
                requests: [],
            },
            {
                kind: "ok",
                id: "l2",
                label: "Second",
                updatedAt: ago(9),
                restitution: small,
                viewed: [],
                requests: [],
            },
        ],
        diffs: {},
    },
    empty: { status: "empty", closed: 0 },
    emptyClosed: { status: "empty", closed: 2 },
    norepo: { status: "no-repo" },
    error: {
        status: "error",
        errors: [
            "goals.0.steps.0.why: Too small: expected string to have >=1 characters",
            "version: Invalid input: expected 1",
        ],
    },
};
