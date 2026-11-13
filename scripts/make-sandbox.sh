#!/bin/sh
# Build a scratch git repo for trying the panel on.
#
#   scripts/make-sandbox.sh <dir>          a small service with a rich set of
#                                          uncommitted changes and three tabs
#   scripts/make-sandbox.sh <dir> clean    stop after the first commit: a blank
#                                          slate for an agent to change
#
# The folder itself is kept and emptied, so a VS Code window that has it open
# stays valid.
set -eu
dir="${1:?usage: make-sandbox.sh <dir> [clean]}"
mkdir -p "$dir"
find "$dir" -mindepth 1 -delete
cd "$dir"
git init -q -b main
git config user.email sandbox@example.com && git config user.name sandbox
mkdir -p src/gateway src/marketplace src/routes src/middleware src/telemetry src/legacy test

# ---------------------------------------------------------------- first commit

cat > src/errors.ts <<'TS'
export class AdapterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AdapterError";
    }
}

export class ConfigError extends AdapterError {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}
TS

cat > src/config.ts <<'TS'
function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

export function readApigeeUrl(): URL {
    return new URL(required("ADAPTER_APIGEE_URL"));
}

export function readPort(): number {
    const raw = process.env.PORT ?? "8080";
    const port = Number(raw);
    if (!Number.isInteger(port)) {
        throw new Error("PORT must be an integer");
    }
    return port;
}

export function loadConfig() {
    return { port: readPort(), apigeeUrl: readApigeeUrl() };
}
TS

cat > src/gateway/client.ts <<'TS'
import { AdapterError } from "../errors.js";

export interface GatewayOptions {
    baseUrl: URL;
    token: () => Promise<string>;
}

export class GatewayClient {
    constructor(private readonly options: GatewayOptions) {}

    url(path: string): string {
        return new URL(path, this.options.baseUrl).toString();
    }

    async request(path: string, init: RequestInit = {}): Promise<Response> {
        const headers = {
            ...init.headers,
            Authorization: `Bearer ${await this.options.token()}`,
        };
        const response = await fetch(this.url(path), { ...init, headers });
        if (!response.ok) {
            throw new AdapterError(`Gateway returned ${response.status}`);
        }
        return response;
    }

    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
        const response = await this.request(path, init);
        return (await response.json()) as T;
    }

    async health(): Promise<boolean> {
        try {
            await this.request("/health");
            return true;
        } catch {
            return false;
        }
    }
}
TS

cat > src/telemetry/metrics.ts <<'TS'
const counters = new Map<string, number>();

export function increment(name: string, by = 1): void {
    counters.set(name, (counters.get(name) ?? 0) + by);
}

export function snapshot(): Record<string, number> {
    return Object.fromEntries(counters);
}
TS

cat > src/marketplace/schema.ts <<'TS'
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
TS

cat > src/marketplace/rewriter.ts <<'TS'
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
TS

cat > src/middleware/logging.ts <<'TS'
export function logRequest(method: string, url: string, status: number, ms: number): void {
    console.log(JSON.stringify({ method, url, status, ms }));
}
TS

cat > src/middleware/auth.ts <<'TS'
import type { IncomingMessage } from "node:http";

export function bearerToken(request: IncomingMessage): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return undefined;
    }
    return header.slice("Bearer ".length);
}
TS

cat > src/routes/inference.ts <<'TS'
import type { IncomingMessage, ServerResponse } from "node:http";

import { GatewayClient } from "../gateway/client.js";

export function inferenceRoute(client: GatewayClient) {
    return async (request: IncomingMessage, response: ServerResponse) => {
        try {
            const body = await readBody(request);
            const result = await client.json("/v1/inference", { method: "POST", body });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify(result));
        } catch (error) {
            response.writeHead(500, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "inference failed" }));
        }
    };
}

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
}
TS

cat > src/legacy/oldRouter.ts <<'TS'
import type { IncomingMessage, ServerResponse } from "node:http";

// Replaced by src/routes/*; kept while the v1 clients migrate.
export function oldRouter(request: IncomingMessage, response: ServerResponse): void {
    const url = request.url ?? "/";
    if (url.startsWith("/v1/chat")) {
        response.writeHead(301, { location: url.replace("/v1/chat", "/v1/inference") });
        response.end();
        return;
    }
    if (url === "/ping") {
        response.writeHead(200);
        response.end("pong");
        return;
    }
    response.writeHead(404);
    response.end();
}
TS

cat > src/index.ts <<'TS'
import { createServer } from "node:http";

import { loadConfig } from "./config.js";
import { GatewayClient } from "./gateway/client.js";
import { oldRouter } from "./legacy/oldRouter.js";
import { inferenceRoute } from "./routes/inference.js";

const config = loadConfig();
const client = new GatewayClient({
    baseUrl: config.apigeeUrl,
    token: async () => process.env.ADAPTER_TOKEN ?? "",
});
const inference = inferenceRoute(client);

const server = createServer((request, response) => {
    if (request.url?.startsWith("/v1/inference")) {
        void inference(request, response);
        return;
    }
    oldRouter(request, response);
});

server.listen(config.port);
TS

cat > src/swagger.js <<'JS'
module.exports = {
    info: {
        title: "Gateway adapter",
        version: "1.0.0",
        description: "Proxies inference and marketplace calls to the gateway.",
    },
};
JS

cat > test/config.test.ts <<'TS'
import assert from "node:assert/strict";
import test from "node:test";

import { readApigeeUrl, readPort } from "../src/config.js";

test("reads the port", () => {
    process.env.PORT = "9090";
    assert.equal(readPort(), 9090);
});

test("defaults the port to 8080", () => {
    delete process.env.PORT;
    assert.equal(readPort(), 8080);
});

test("rejects a port that is not an integer", () => {
    process.env.PORT = "eighty";
    assert.throws(() => readPort(), /PORT must be an integer/);
});

test("requires the Apigee URL", () => {
    delete process.env.ADAPTER_APIGEE_URL;
    assert.throws(() => readApigeeUrl(), /is required/);
});

test("reads the Apigee URL", () => {
    process.env.ADAPTER_APIGEE_URL = "https://apigee.example.com";
    assert.equal(readApigeeUrl().hostname, "apigee.example.com");
});
TS

cat > test/gateway.test.ts <<'TS'
import assert from "node:assert/strict";
import test from "node:test";

import { GatewayClient } from "../src/gateway/client.js";

function stubFetch(handler: (request: Request) => Response) {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
        handler(new Request(input, init))) as typeof fetch;
}

const client = () =>
    new GatewayClient({
        baseUrl: new URL("https://gateway.example.com"),
        token: async () => "secret",
    });

test("sends the bearer token", async () => {
    let seen = "";
    stubFetch((request) => {
        seen = request.headers.get("authorization") ?? "";
        return new Response("{}");
    });
    await client().request("/ping");
    assert.equal(seen, "Bearer secret");
});

test("parses a json response", async () => {
    stubFetch(() => new Response(JSON.stringify({ ok: true })));
    assert.deepEqual(await client().json("/ping"), { ok: true });
});

test("reports an unhealthy gateway", async () => {
    stubFetch(() => new Response("down", { status: 503 }));
    assert.equal(await client().health(), false);
});

test("fails on a non-2xx response", async () => {
    stubFetch(() => new Response("nope", { status: 500 }));
    await assert.rejects(() => client().request("/ping"), /Gateway returned 500/);
});
TS

cat > test/marketplace.test.ts <<'TS'
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
TS

cat > README.md <<'MD'
# Gateway adapter

Proxies inference and marketplace calls to the gateway through Apigee.

## Configuration

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP port, 8080 by default |
| `ADAPTER_APIGEE_URL` | Base URL of the Apigee proxy |
| `ADAPTER_TOKEN` | Bearer token for the gateway |

## Routes

- `POST /v1/inference` forwards the body to the gateway.
- `GET /v1/marketplace` returns the rewritten plugin catalog.

## Running

```sh
npm run build && node dist/index.js
```
MD

git add -A && git commit -q -m "Initial commit"

if [ "${2:-}" = "clean" ]; then
    echo "Clean sandbox ready: $dir"
    exit 0
fi

# ------------------------------------------------- uncommitted work: the diffs

cat > src/errors.ts <<'TS'
export class AdapterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AdapterError";
    }
}

export class ConfigError extends AdapterError {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

export class GatewayError extends AdapterError {
    constructor(
        message: string,
        readonly upstreamStatus: number,
    ) {
        super(message);
        this.name = "GatewayError";
    }
}
TS

cat > src/config.ts <<'TS'
function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

export function readApigeeUrl(): URL {
    const url = new URL(required("ADAPTER_APIGEE_URL"));
    if (url.protocol !== "https:") {
        throw new Error("ADAPTER_APIGEE_URL must use https");
    }
    return url;
}

export function readPort(): number {
    const raw = process.env.PORT ?? "8080";
    const port = Number(raw);
    if (!Number.isInteger(port)) {
        throw new Error("PORT must be an integer");
    }
    return port;
}

export function readMaxRetries(): number {
    const raw = process.env.ADAPTER_MAX_RETRIES ?? "2";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
        throw new Error("ADAPTER_MAX_RETRIES must be a non-negative integer");
    }
    return value;
}

export function loadConfig() {
    return {
        port: readPort(),
        apigeeUrl: readApigeeUrl(),
        maxRetries: readMaxRetries(),
    };
}
TS

cat > src/gateway/retry.ts <<'TS'
import { GatewayError } from "../errors.js";
import { recordRetry } from "../telemetry/metrics.js";

export interface RetryOptions {
    attempts?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Server errors are worth another try; anything else is the caller's problem. */
function isTransient(error: unknown): boolean {
    return error instanceof GatewayError && error.upstreamStatus >= 500;
}

export async function withRetry<T>(
    action: () => Promise<T>,
    { attempts = 3, baseDelayMs = 200, shouldRetry = isTransient }: RetryOptions = {},
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await action();
        } catch (error) {
            lastError = error;
            if (attempt === attempts || !shouldRetry(error)) {
                throw error;
            }
            recordRetry(attempt);
            await sleep(baseDelayMs * 2 ** (attempt - 1));
        }
    }
    throw lastError;
}
TS

cat > src/gateway/client.ts <<'TS'
import { GatewayError } from "../errors.js";
import { withRetry } from "./retry.js";

export interface GatewayOptions {
    baseUrl: URL;
    token: () => Promise<string>;
    maxRetries?: number;
}

export class GatewayClient {
    constructor(private readonly options: GatewayOptions) {}

    url(path: string): string {
        return new URL(path, this.options.baseUrl).toString();
    }

    async request(path: string, init: RequestInit = {}): Promise<Response> {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${await this.options.token()}`);
        headers.set("X-Request-Id", crypto.randomUUID());
        const response = await fetch(this.url(path), { ...init, headers });
        if (!response.ok) {
            throw new GatewayError(
                `Gateway returned ${response.status}`,
                response.status,
            );
        }
        return response;
    }

    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
        const attempts = (this.options.maxRetries ?? 2) + 1;
        const response = await withRetry(() => this.request(path, init), {
            attempts,
        });
        return (await response.json()) as T;
    }

    async health(): Promise<boolean> {
        try {
            await this.request("/health");
            return true;
        } catch {
            return false;
        }
    }
}
TS

cat > src/telemetry/metrics.ts <<'TS'
const counters = new Map<string, number>();

export function increment(name: string, by = 1): void {
    counters.set(name, (counters.get(name) ?? 0) + by);
}

export function snapshot(): Record<string, number> {
    return Object.fromEntries(counters);
}

export function recordRetry(attempt: number): void {
    increment("gateway_retries_total");
    increment(`gateway_retry_attempt_${attempt}`);
}
TS

cat > src/marketplace/schema.ts <<'TS'
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
TS

cat > src/marketplace/rewriter.ts <<'TS'
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
TS

cat > src/middleware/logging.ts <<'TS'
export function logRequest(method: string, url: string, status: number, ms: number): void {
    console.log(JSON.stringify({ method, url, status, ms }));
}

export function logError(error: unknown): void {
    const name = error instanceof Error ? error.name : "Unknown";
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", name, message }));
}
TS

cat > src/routes/inference.ts <<'TS'
import type { IncomingMessage, ServerResponse } from "node:http";

import { GatewayClient } from "../gateway/client.js";
import { logError } from "../middleware/logging.js";

export function inferenceRoute(client: GatewayClient) {
    return async (request: IncomingMessage, response: ServerResponse) => {
        try {
            const body = await readBody(request);
            const result = await client.json("/v1/inference", { method: "POST", body });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify(result));
        } catch (error) {
            logError(error);
            response.writeHead(500, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "inference failed" }));
        }
    };
}

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
}
TS

rm src/legacy/oldRouter.ts

cat > src/index.ts <<'TS'
import { createServer } from "node:http";

import { loadConfig } from "./config.js";
import { GatewayClient } from "./gateway/client.js";
import { inferenceRoute } from "./routes/inference.js";

const config = loadConfig();
const client = new GatewayClient({
    baseUrl: config.apigeeUrl,
    token: async () => process.env.ADAPTER_TOKEN ?? "",
    maxRetries: config.maxRetries,
});
const inference = inferenceRoute(client);

const server = createServer((request, response) => {
    if (request.url?.startsWith("/v1/inference")) {
        void inference(request, response);
        return;
    }
    response.writeHead(404);
    response.end();
});

server.listen(config.port);
TS

cat > test/config.test.ts <<'TS'
import assert from "node:assert/strict";
import test from "node:test";

import { readApigeeUrl, readMaxRetries, readPort } from "../src/config.js";

test("reads the port", () => {
    process.env.PORT = "9090";
    assert.equal(readPort(), 9090);
});

test("rejects a plain-http Apigee URL", () => {
    process.env.ADAPTER_APIGEE_URL = "http://apigee.example.com";
    assert.throws(() => readApigeeUrl(), /must use https/);
});

test("defaults the port to 8080", () => {
    delete process.env.PORT;
    assert.equal(readPort(), 8080);
});

test("rejects a port that is not an integer", () => {
    process.env.PORT = "eighty";
    assert.throws(() => readPort(), /PORT must be an integer/);
});

test("requires the Apigee URL", () => {
    delete process.env.ADAPTER_APIGEE_URL;
    assert.throws(() => readApigeeUrl(), /is required/);
});

test("reads the Apigee URL", () => {
    process.env.ADAPTER_APIGEE_URL = "https://apigee.example.com";
    assert.equal(readApigeeUrl().hostname, "apigee.example.com");
});

test("defaults to two retries", () => {
    delete process.env.ADAPTER_MAX_RETRIES;
    assert.equal(readMaxRetries(), 2);
});

test("rejects a negative retry count", () => {
    process.env.ADAPTER_MAX_RETRIES = "-1";
    assert.throws(() => readMaxRetries(), /non-negative integer/);
});
TS

cat > test/gateway.test.ts <<'TS'
import assert from "node:assert/strict";
import test from "node:test";

import { GatewayClient } from "../src/gateway/client.js";

function stubFetch(handler: (request: Request) => Response) {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
        handler(new Request(input, init))) as typeof fetch;
}

const client = () =>
    new GatewayClient({
        baseUrl: new URL("https://gateway.example.com"),
        token: async () => "secret",
    });

test("sends the bearer token", async () => {
    let seen = "";
    stubFetch((request) => {
        seen = request.headers.get("authorization") ?? "";
        return new Response("{}");
    });
    await client().request("/ping");
    assert.equal(seen, "Bearer secret");
});

test("sends a single Authorization header, plus a request id", async () => {
    let request: Request | undefined;
    stubFetch((incoming) => {
        request = incoming;
        return new Response("{}");
    });
    const headers = { authorization: "Bearer stale" };
    await client().request("/ping", { headers });
    assert.equal(request?.headers.get("authorization"), "Bearer secret");
    assert.match(request?.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
});

test("parses a json response", async () => {
    stubFetch(() => new Response(JSON.stringify({ ok: true })));
    assert.deepEqual(await client().json("/ping"), { ok: true });
});

test("reports an unhealthy gateway", async () => {
    stubFetch(() => new Response("down", { status: 503 }));
    assert.equal(await client().health(), false);
});

test("fails on a non-2xx response", async () => {
    stubFetch(() => new Response("nope", { status: 500 }));
    await assert.rejects(() => client().request("/ping"), /Gateway returned 500/);
});
TS

cat > test/retry.test.ts <<'TS'
import assert from "node:assert/strict";
import test from "node:test";

import { GatewayError } from "../src/errors.js";
import { withRetry } from "../src/gateway/retry.js";

const fast = { baseDelayMs: 1 };

test("returns the first success without retrying", async () => {
    let calls = 0;
    const value = await withRetry(async () => {
        calls += 1;
        return "ok";
    }, fast);
    assert.equal(value, "ok");
    assert.equal(calls, 1);
});

test("retries a 5xx and then succeeds", async () => {
    let calls = 0;
    const value = await withRetry(async () => {
        calls += 1;
        if (calls < 3) {
            throw new GatewayError("down", 503);
        }
        return "ok";
    }, fast);
    assert.equal(value, "ok");
    assert.equal(calls, 3);
});

test("does not retry a 4xx", async () => {
    let calls = 0;
    await assert.rejects(
        withRetry(async () => {
            calls += 1;
            throw new GatewayError("bad request", 400);
        }, fast),
        /bad request/,
    );
    assert.equal(calls, 1);
});

test("gives up after the last attempt", async () => {
    let calls = 0;
    await assert.rejects(
        withRetry(
            async () => {
                calls += 1;
                throw new GatewayError("down", 502);
            },
            { ...fast, attempts: 2 },
        ),
        /down/,
    );
    assert.equal(calls, 2);
});
TS

cat > test/marketplace.test.ts <<'TS'
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
TS

cat > README.md <<'MD'
# Gateway adapter

Proxies inference and marketplace calls to the gateway through Apigee.

## Configuration

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP port, 8080 by default |
| `ADAPTER_APIGEE_URL` | Base URL of the Apigee proxy, https only |
| `ADAPTER_TOKEN` | Bearer token for the gateway |

## Routes

- `POST /v1/inference` forwards the body to the gateway.
- `GET /v1/marketplace` returns the rewritten plugin catalog.

## Retries

The adapter retries gateway responses with a 5xx status, with exponential
backoff starting at 200 ms, for up to `ADAPTER_MAX_RETRIES` extra attempts
(2 by default). 4xx responses are returned to the caller at once.

## Running

```sh
npm run build && node dist/index.js
```
MD

# ---------------------------------------------------- three restitutions (tabs)

mkdir -p .restitution

cat > .restitution/review-fixes.json <<'JSON'
{
    "version": 1,
    "label": "Review fixes",
    "request": "/code-review --fix",
    "goals": [
        {
            "title": "Reject plain-http Apigee URLs",
            "ref": "#1",
            "steps": [
                {
                    "file": "src/config.ts",
                    "lines": [
                        7,
                        17
                    ],
                    "why": "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text."
                },
                {
                    "file": "test/config.test.ts",
                    "lines": [
                        1,
                        18
                    ],
                    "link": "then",
                    "why": "write the test that rejects an http URL, to catch a regression early."
                },
                {
                    "file": "README.md",
                    "lines": [
                        7,
                        13
                    ],
                    "link": "finally",
                    "why": "note in the README that the URL must be https, so operators know before deploying."
                }
            ]
        },
        {
            "title": "Stop sending two Authorization headers",
            "ref": "#2",
            "steps": [
                {
                    "file": "src/gateway/client.ts",
                    "lines": [
                        15,
                        38
                    ],
                    "why": "Set Authorization through Headers, because a plain object kept both casings."
                },
                {
                    "file": "test/gateway.test.ts",
                    "link": "then",
                    "why": "assert that a single header goes out, to prove the casing clash is gone."
                }
            ]
        },
        {
            "title": "One bad plugin must not block the catalog",
            "ref": "#4",
            "steps": [
                {
                    "file": "src/marketplace/schema.ts",
                    "why": "Parse each plugin on its own, so one bad entry can't fail the catalog."
                },
                {
                    "file": "src/marketplace/rewriter.ts",
                    "link": "so",
                    "why": "rewrite only the plugins that parsed, and keep the skipped count."
                },
                {
                    "file": "test/marketplace.test.ts",
                    "link": "then",
                    "why": "write the unit tests to cover what was added, with one broken plugin among good ones."
                }
            ]
        }
    ]
}
JSON

cat > .restitution/retries.json <<'JSON'
{
    "version": 1,
    "label": "Retries and logging",
    "request": "Retry transient gateway failures, and log failures as JSON",
    "goals": [
        {
            "title": "Retry transient gateway failures",
            "steps": [
                {
                    "file": "src/errors.ts",
                    "lines": [
                        11,
                        23
                    ],
                    "why": "Add a GatewayError that carries the upstream status, so callers can tell a 5xx from a 4xx."
                },
                {
                    "file": "src/telemetry/metrics.ts",
                    "link": "in parallel",
                    "why": "count every retry, so flaky gateway periods show up."
                },
                {
                    "file": "src/gateway/retry.ts",
                    "link": "so",
                    "why": "build withRetry on top of both, retrying only 5xx responses with exponential backoff."
                },
                {
                    "file": "src/gateway/client.ts",
                    "link": "then",
                    "why": "throw GatewayError and run json() through withRetry, so every JSON call benefits."
                },
                {
                    "file": "src/config.ts",
                    "lines": [
                        23,
                        41
                    ],
                    "link": "then",
                    "why": "read ADAPTER_MAX_RETRIES with a safe default, so operators can tune the retries."
                },
                {
                    "file": "src/index.ts",
                    "lines": [
                        2,
                        14
                    ],
                    "link": "then",
                    "why": "pass the configured count into the client at startup, so the setting takes effect."
                },
                {
                    "file": "test/retry.test.ts",
                    "link": "then",
                    "why": "write the unit tests for the retry rules: success, 5xx recovery, 4xx and exhaustion."
                },
                {
                    "file": "test/config.test.ts",
                    "lines": [
                        32,
                        44
                    ],
                    "link": "in parallel",
                    "why": "test the new setting's default and its invalid value."
                },
                {
                    "file": "README.md",
                    "lines": [
                        15,
                        26
                    ],
                    "link": "finally",
                    "why": "describe the retry behaviour and the setting, so operators know what to expect."
                }
            ]
        },
        {
            "title": "Log failures as JSON",
            "steps": [
                {
                    "file": "src/middleware/logging.ts",
                    "why": "Add logError, printing the error's name and message as JSON, so failures are searchable."
                },
                {
                    "file": "src/routes/inference.ts",
                    "link": "then",
                    "why": "call it where inference fails, instead of swallowing the error."
                }
            ]
        }
    ]
}
JSON

cat > .restitution/legacy-router.json <<'JSON'
{
    "version": 1,
    "label": "Remove legacy router",
    "request": "Remove the legacy v1 router",
    "goals": [
        {
            "title": "Delete the legacy router",
            "steps": [
                {
                    "file": "src/legacy/oldRouter.ts",
                    "why": "Delete the v1 redirect router, because every client moved to /v1/inference."
                },
                {
                    "file": "src/index.ts",
                    "link": "so",
                    "why": "stop wiring it in and answer 404 for unknown paths, since nothing falls through to the deleted router."
                }
            ]
        }
    ]
}
JSON

# Spread the tabs over time, so the order and "updated" hints look real.
age() { touch -t "$(date -v-"$1" +%Y%m%d%H%M.%S)" ".restitution/$2.json" 2>/dev/null || true; }
age 2M review-fixes
age 25M retries
age 3H legacy-router

# Leave everything unstaged, like an agent working in the tree would.
git reset -q

echo "Sandbox ready: $dir"
