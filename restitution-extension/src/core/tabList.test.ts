import { describe, expect, it } from "vitest";

import type { Tab } from "./messages";
import { describeTabs } from "./tabList";

const NOW = Date.parse("2026-11-23T12:00:00Z");

function ok(id: string, label: string, minutesAgo: number, requests = 0): Tab {
    return {
        kind: "ok",
        id,
        label,
        updatedAt: NOW - minutesAgo * 60_000,
        restitution: {
            version: 1,
            goals: [
                { title: "A", steps: [{ why: "x" }, { why: "y" }] },
                { title: "B", steps: [{ why: "z" }] },
            ],
        },
        code: {},
        viewed: [],
        requests: Array.from({ length: requests }, (_, n) => ({
            step: `s${n}`,
            label: "1.1",
            clarify: true,
        })),
        answers: [],
        resolved: [],
    };
}

describe("describeTabs", () => {
    it("says so when the panel is empty", () => {
        expect(describeTabs([], undefined, NOW)).toMatch(/no restitutions/);
    });

    it("lists each tab with its id, size and age, and marks the agent's own", () => {
        const text = describeTabs(
            [ok("abc", "Retries", 5, 2), ok("def", "Docs", 90)],
            "def",
            NOW,
        );
        expect(text).toContain(
            '- abc "Retries": 2 goals, 3 steps, updated 5 minutes ago, 2 open requests from the user',
        );
        expect(text).toContain(
            '- def "Docs": 2 goals, 3 steps, updated 1 hour ago  <- your current tab',
        );
        expect(text).toMatch(/Give an id to restitution_submit/);
    });

    it("shows an unreadable tab by its id", () => {
        const broken: Tab = {
            kind: "error",
            id: "zzz",
            label: "zzz",
            updatedAt: NOW,
            errors: ["goals: required"],
        };
        expect(describeTabs([broken], undefined, NOW)).toContain(
            "- zzz: unreadable, updated now",
        );
    });
});
