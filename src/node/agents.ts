export type Agent = "claude-user" | "claude-project" | "codex";

/** Single-quote for a POSIX shell. */
export function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}

const REGISTRATIONS: Record<Agent, { remove: string; add: string }> = {
    "claude-user": {
        remove: "claude mcp remove restitution --scope user",
        add: "claude mcp add --scope user restitution --",
    },
    "claude-project": {
        remove: "claude mcp remove restitution --scope local",
        add: "claude mcp add --scope local restitution --",
    },
    codex: {
        remove: "codex mcp remove restitution",
        add: "codex mcp add restitution --",
    },
};

/**
 * The shell command that registers the MCP server with an agent. It removes
 * any older registration first, so connecting twice just refreshes the path.
 */
export function connectCommand(agent: Agent, serverPath: string): string {
    const { remove, add } = REGISTRATIONS[agent];
    return `${remove} >/dev/null 2>&1 || true; ${add} node ${shellQuote(serverPath)}`;
}
