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
