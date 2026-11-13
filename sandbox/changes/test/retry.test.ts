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
