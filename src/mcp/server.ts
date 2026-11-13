import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";

import { GUIDE, SERVER_INSTRUCTIONS } from "../core/guide";
import { RestitutionSchema } from "../core/restitution";
import { findGitRoot } from "../node/gitRoot";
import { newTabId } from "../node/store/paths";
import { submitRestitution } from "../node/submit";

/**
 * Stdio MCP server. The agent spawns it in the project folder, so the repo is
 * found from the working directory: no port, no token, nothing to configure.
 */
const server = new McpServer(
    { name: "restitution", version: "0.0.1" },
    { instructions: SERVER_INSTRUCTIONS },
);

// One agent session = one tab: the first submit creates it, later ones replace it.
let tabId: string | undefined;

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
        inputSchema: {
            // The file version is ours to set, not the agent's.
            ...RestitutionSchema.omit({ version: true }).shape,
            id: z
                .string()
                .regex(/^[a-z0-9][a-z0-9-]{0,63}$/i)
                .optional()
                .describe(
                    "Only when updating an existing restitution, e.g. after a Clarify request: its id. Leave it out otherwise.",
                ),
        },
    },
    async ({ id, ...input }) => {
        const root = process.env.RESTITUTION_ROOT ?? findGitRoot(process.cwd());
        if (!root) {
            return text(
                "Not inside a git repository, so there is nowhere to save the restitution.",
                true,
            );
        }
        // A given id is the tab to update; it stays this session's tab after.
        tabId = id ?? tabId ?? newTabId();
        return text(
            await submitRestitution(root, tabId, { version: 1, ...input }),
        );
    },
);

async function main(): Promise<void> {
    await server.connect(new StdioServerTransport());
}

void main();
