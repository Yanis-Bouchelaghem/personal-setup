import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { GUIDE, SERVER_INSTRUCTIONS } from "../core/guide";
import { RestitutionSchema } from "../core/restitution";
import { findGitRoot } from "../node/gitRoot";
import { submitRestitution } from "../node/submit";

/**
 * Stdio MCP server. The agent spawns it in the project folder, so the repo is
 * found from the working directory: no port, no token, nothing to configure.
 */
const server = new McpServer(
    { name: "restitution", version: "0.0.1" },
    { instructions: SERVER_INSTRUCTIONS },
);

const text = (message: string, isError = false) => ({
    content: [{ type: "text" as const, text: message }],
    isError,
});

server.registerTool(
    "restitution_guide",
    {
        description:
            "How to write a restitution: the short reading guide the user gets after you change code. Call it once before restitution_submit.",
    },
    () => text(GUIDE),
);

server.registerTool(
    "restitution_submit",
    {
        description:
            "Show the user a short, ordered reading guide to the code changes you just made. Saves it for their editor and reports changed code that no step explains.",
        // The file version is ours to set, not the agent's.
        inputSchema: RestitutionSchema.omit({ version: true }).shape,
    },
    async (input) => {
        const root = process.env.RESTITUTION_ROOT ?? findGitRoot(process.cwd());
        if (!root) {
            return text(
                "Not inside a git repository, so there is nowhere to save the restitution.",
                true,
            );
        }
        return text(await submitRestitution(root, { version: 1, ...input }));
    },
);

async function main(): Promise<void> {
    await server.connect(new StdioServerTransport());
}

void main();
