#!/bin/sh
# Build a scratch git repo with uncommitted changes and a matching restitution,
# so the panel has real diffs to show. Usage: scripts/make-sandbox.sh <dir> [clean]
# With "clean" it stops after the first commit: a blank slate for an agent to change.
set -eu
dir="${1:?usage: make-sandbox.sh <dir>}"
rm -rf "$dir" && mkdir -p "$dir/src/gateway" "$dir/test" && cd "$dir"
git init -q -b main
git config user.email sandbox@example.com && git config user.name sandbox

cat > src/config.ts <<'TS'
export function readApigeeUrl(): URL {
    const raw = process.env.ADAPTER_APIGEE_URL;
    if (!raw) {
        throw new Error("ADAPTER_APIGEE_URL is required");
    }
    return new URL(raw);
}
TS
cat > src/gateway/client.ts <<'TS'
export class GatewayClient {
    constructor(private readonly token: () => Promise<string>) {}

    async request(url: string, init: RequestInit = {}) {
        const headers = {
            ...init.headers,
            Authorization: `Bearer ${await this.token()}`,
        };
        return fetch(url, { ...init, headers });
    }
}
TS
cat > src/swagger.js <<'JS'
module.exports = { info: { title: "Adapter", version: "1.0.0" } };
JS
git add -A && git commit -q -m "Initial commit"

if [ "${2:-}" = "clean" ]; then
    echo "Clean sandbox ready: $dir"
    exit 0
fi

# Uncommitted work: two edits and one new file.
cat > src/config.ts <<'TS'
export function readApigeeUrl(): URL {
    const raw = process.env.ADAPTER_APIGEE_URL;
    if (!raw) {
        throw new Error("ADAPTER_APIGEE_URL is required");
    }
    const url = new URL(raw);
    if (url.protocol !== "https:") {
        throw new Error("ADAPTER_APIGEE_URL must use https");
    }
    return url;
}
TS
cat > src/gateway/client.ts <<'TS'
export class GatewayClient {
    constructor(private readonly token: () => Promise<string>) {}

    async request(url: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${await this.token()}`);
        return fetch(url, { ...init, headers });
    }
}
TS
cat > test/config.test.ts <<'TS'
import assert from "node:assert/strict";
import test from "node:test";

import { readApigeeUrl } from "../src/config.js";

test("rejects a plain-http Apigee URL", () => {
    process.env.ADAPTER_APIGEE_URL = "http://apigee.example.com";
    assert.throws(() => readApigeeUrl(), /must use https/);
});
TS

mkdir -p .restitution && cat > .restitution/working.json <<'JSON'
{
    "version": 1,
    "request": "Fix two review findings",
    "goals": [
        {
            "title": "Reject plain-http Apigee URLs",
            "ref": "#1",
            "steps": [
                {
                    "file": "src/config.ts",
                    "why": "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text."
                },
                {
                    "file": "test/config.test.ts",
                    "why": "Pin the startup failure for http URLs, to catch a regression early."
                }
            ]
        },
        {
            "title": "Stop sending two Authorization headers",
            "ref": "#2",
            "steps": [
                {
                    "file": "src/gateway/client.ts",
                    "why": "Set Authorization through Headers, because a plain object kept both casings."
                }
            ]
        },
        {
            "title": "Keep the swagger file in sync",
            "steps": [
                {
                    "file": "src/swagger.js",
                    "why": "Describe the https-only setting, so the docs match the new behaviour."
                }
            ]
        }
    ]
}
JSON
echo "Sandbox ready: $dir"
