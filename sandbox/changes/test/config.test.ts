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
