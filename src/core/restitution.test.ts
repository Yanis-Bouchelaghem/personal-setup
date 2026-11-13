import { describe, expect, it } from "vitest";

import { parseRestitution } from "./restitution";

const valid = {
    version: 1,
    request: "Fix the review findings",
    goals: [
        {
            title: "Reject plain-http Apigee URLs",
            steps: [
                {
                    file: "src/config.ts",
                    why: "Reject non-https URLs at startup, so tokens never travel in clear text.",
                },
            ],
        },
    ],
};

describe("parseRestitution", () => {
    it("accepts a valid file", () => {
        const result = parseRestitution(JSON.stringify(valid));
        expect(result.ok).toBe(true);
    });

    it("keeps optional fields optional", () => {
        const minimal = {
            version: 1,
            goals: [{ title: "One goal", steps: [{ why: "Do the thing." }] }],
        };
        expect(parseRestitution(JSON.stringify(minimal)).ok).toBe(true);
    });

    it("reports invalid JSON", () => {
        const result = parseRestitution("{ nope");
        expect(result).toMatchObject({ ok: false });
        expect(!result.ok && result.errors[0]).toMatch(/Not valid JSON/);
    });

    it("points at the field that is wrong", () => {
        const broken = structuredClone(valid);
        broken.goals[0]!.steps[0]!.why = "";
        const result = parseRestitution(JSON.stringify(broken));
        expect(!result.ok && result.errors[0]).toMatch(
            /^goals\.0\.steps\.0\.why/,
        );
    });

    it("requires at least one goal and one step", () => {
        expect(parseRestitution('{"version":1,"goals":[]}').ok).toBe(false);
        const noSteps = { version: 1, goals: [{ title: "T", steps: [] }] };
        expect(parseRestitution(JSON.stringify(noSteps)).ok).toBe(false);
    });

    it("rejects an unknown version", () => {
        const result = parseRestitution(
            JSON.stringify({ ...valid, version: 2 }),
        );
        expect(result.ok).toBe(false);
    });
});
