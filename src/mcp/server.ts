import { readFile } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";

import { pinAnswers } from "../core/answers";
import { applyEdits, EditSchema, outline } from "../core/edit";
import { FEEDBACK_GUIDE, GUIDE, SERVER_INSTRUCTIONS } from "../core/guide";
import {
    parseRestitution,
    type Restitution,
    RestitutionSchema,
} from "../core/restitution";
import { findGitRoot } from "../node/gitRoot";
import { addAnswers } from "../node/store/answers";
import { newTabId, tabFile } from "../node/store/paths";
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

const TAB_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/i);

const repoRoot = () =>
    process.env.RESTITUTION_ROOT ?? findGitRoot(process.cwd());

const text = (message: string, isError = false) => ({
    content: [{ type: "text" as const, text: message }],
    isError,
});

/** The restitution `id` as saved, or why it can't be read. */
async function readSaved(
    root: string,
    id: string,
): Promise<{ ok: true; value: Restitution } | { ok: false }> {
    const saved = await readFile(tabFile(root, id), "utf8").catch(
        () => undefined,
    );
    const parsed = saved === undefined ? undefined : parseRestitution(saved);
    return parsed?.ok ? parsed : { ok: false };
}

const unreadable = (id: string) =>
    text(
        `There is no readable restitution "${id}" (it may have been closed). Submit it again with restitution_submit.`,
        true,
    );

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
            id: TAB_ID.optional().describe(
                "Only when updating an existing restitution after the user's review: its id. Leave it out otherwise.",
            ),
        },
    },
    async ({ id, ...input }) => {
        const root = repoRoot();
        if (!root) {
            return text(
                "Not inside a git repository. Restitution compares the files with their last commit (git) to show what changed, so it needs one. Tell the user; they can create it with `git init`, or from the Restitution panel. Your code changes are unaffected.",
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

server.registerTool(
    "restitution_edit",
    {
        description:
            "Change part of a restitution you already submitted: change, split, add or remove steps and goals, without resubmitting the rest. Steps you don't mention stay exactly as they were. Reports coverage like restitution_submit, and the new step labels.",
        inputSchema: {
            id: TAB_ID.optional().describe(
                "The restitution to edit. Leave it out for the one you submitted in this session; after the user's review, use the id given there.",
            ),
            edits: z
                .array(EditSchema)
                .min(1)
                .describe(
                    "Applied together; every label and goal number refers to the restitution as it was before these edits.",
                ),
        },
    },
    async ({ id, edits }) => {
        const root = repoRoot();
        if (!root) {
            return text("Not inside a git repository.", true);
        }
        const target = id ?? tabId;
        if (!target) {
            return text(
                "There is no restitution to edit in this session: call restitution_submit first, or give the id of the one to edit.",
                true,
            );
        }
        const parsed = await readSaved(root, target);
        if (!parsed.ok) {
            return unreadable(target);
        }
        const result = applyEdits(parsed.value, edits);
        if (!result.ok) {
            return text(
                `Nothing was changed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`,
                true,
            );
        }
        tabId = target;
        const report = await submitRestitution(root, target, result.value);
        return text(
            `${report}\n\nThe steps are now:\n${outline(result.value)}`,
        );
    },
);

server.registerTool(
    "restitution_answer",
    {
        description:
            "Answer the user's comments from their review in their Restitution panel: each answer shows under the comment it answers, on its step, until the user resolves it. Call it after any restitution_edit, with step labels as they are then.",
        inputSchema: {
            id: TAB_ID.optional().describe(
                "The restitution the review is about: the id given in the review.",
            ),
            answers: z
                .array(
                    z.object({
                        step: z
                            .string()
                            .regex(/^\d+\.\d+$/)
                            .describe(
                                'The step to show the answer on, by its label now (after your edits), like "2.1".',
                            ),
                        comment: z
                            .string()
                            .min(1)
                            .describe("The user's comment, word for word."),
                        answer: z
                            .string()
                            .min(1)
                            .describe(
                                "Your answer: short and plain, in the user's language.",
                            ),
                    }),
                )
                .min(1),
        },
    },
    async ({ id, answers }) => {
        const root = repoRoot();
        if (!root) {
            return text("Not inside a git repository.", true);
        }
        const target = id ?? tabId;
        if (!target) {
            return text(
                "Give the id of the restitution the review is about.",
                true,
            );
        }
        const parsed = await readSaved(root, target);
        if (!parsed.ok) {
            return unreadable(target);
        }
        const pinned = pinAnswers(parsed.value, answers, Date.now(), newTabId);
        if (!pinned.ok) {
            return text(
                `Nothing was saved:\n${pinned.errors.map((error) => `- ${error}`).join("\n")}\nThe steps are:\n${outline(parsed.value)}`,
                true,
            );
        }
        await addAnswers(root, target, pinned.answers);
        return text(
            `Shown in the user's panel, under their comments on ${pinned.answers.map((answer) => answer.label).join(", ")}. No need to repeat them in your reply.`,
        );
    },
);

server.registerTool(
    "restitution_feedback",
    {
        description:
            "Call this first when the user pastes their review of a restitution (steps to clarify, comments). Returns how to handle the review and the restitution it is about.",
        inputSchema: {
            id: TAB_ID.describe("The restitution id given in the review."),
        },
    },
    async ({ id }) => {
        const root = repoRoot();
        if (!root) {
            return text("Not inside a git repository.", true);
        }
        const restitution = await readFile(tabFile(root, id), "utf8").catch(
            () => undefined,
        );
        if (restitution === undefined) {
            return text(
                `There is no restitution "${id}" in this repository (it may have been closed).`,
                true,
            );
        }
        return text(
            `${FEEDBACK_GUIDE}\nThe id: ${id}\n\nThe restitution:\n${restitution}`,
        );
    },
);

async function main(): Promise<void> {
    await server.connect(new StdioServerTransport());
}

void main();
