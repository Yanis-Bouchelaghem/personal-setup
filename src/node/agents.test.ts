import { describe, expect, it } from "vitest";

import { connectCommand, shellQuote } from "./agents";

describe("shellQuote", () => {
    it("keeps spaces and quotes safe", () => {
        expect(shellQuote("/a b/it's.js")).toBe(`'/a b/it'\\''s.js'`);
    });
});

describe("connectCommand", () => {
    const path = "/Users/me/Library/Application Support/Code/mcp-server.js";

    it("registers Claude Code for all projects", () => {
        const command = connectCommand("claude-user", path);
        expect(command).toContain("claude mcp add --scope user restitution --");
        expect(command).toContain(`node '${path}'`);
    });

    it("registers Claude Code for the workspace only", () => {
        expect(connectCommand("claude-project", path)).toContain(
            "--scope local",
        );
    });

    it("registers Codex", () => {
        expect(connectCommand("codex", path)).toContain(
            "codex mcp add restitution --",
        );
    });

    it("removes the older registration first", () => {
        expect(connectCommand("codex", path)).toMatch(
            /^codex mcp remove restitution .*; codex mcp add/,
        );
    });
});
