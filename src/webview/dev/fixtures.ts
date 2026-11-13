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
                    file: "../src/swagger.js",
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

export const fixtures: Record<string, ViewState> = {
    many: { status: "ok", restitution: many },
    long: { status: "ok", restitution: long },
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
