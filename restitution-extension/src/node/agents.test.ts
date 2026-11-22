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
        const command = connectCommand("claude-user", path, "darwin");
        expect(command).toContain("claude mcp add --scope user restitution --");
        expect(command).toContain(`node '${path}'`);
    });

    it("registers Claude Code for the workspace only", () => {
        expect(connectCommand("claude-project", path, "darwin")).toContain(
            "--scope local",
        );
    });

    it("speaks cmd.exe on Windows", () => {
        const windows = "C:\\Users\\me\\AppData\\Roaming\\Code\\mcp-server.js";
        const command = connectCommand("claude-user", windows, "win32");
        expect(command).toBe(
            `claude mcp remove restitution --scope user >NUL 2>&1 & claude mcp add --scope user restitution -- node "${windows}"`,
        );
    });

    it("registers Codex", () => {
        expect(connectCommand("codex", path, "darwin")).toContain(
            "codex mcp add restitution --",
        );
    });

    it("removes the older registration first", () => {
        expect(connectCommand("codex", path, "darwin")).toMatch(
            /^codex mcp remove restitution .*; codex mcp add/,
        );
    });
});
