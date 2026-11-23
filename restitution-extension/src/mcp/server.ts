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
import { describeTabs } from "../core/tabList";
import { findGitRoot } from "../node/gitRoot";
import { addAnswers, readAnswers } from "../node/store/answers";
import { newTabId, tabFile } from "../node/store/paths";
import { readTabs } from "../node/store/tabs";
import { submitRestitution } from "../node/submit";

/**
 * Stdio MCP server. The agent spawns it in the project folder, so the repo is
 * found from the working directory: no port, no token, nothing to configure.
 */
const server = new McpServer(
    { name: "restitution", version: "0.0.1" },
    { instructions: SERVER_INSTRUCTIONS },
);

// A session's current tab: the first submit creates it and later ones replace it,
// until the agent opens another (newTab) or works on one by id, which becomes current.
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
    "restitution_list",
    {
        description:
            "List the restitutions in the user's panel for this repository, with their ids and which one is your current tab. Use it before working on a tab that is not the one you just submitted.",
    },
    async () => {
        const root = repoRoot();
        if (!root) {
            return text("Not inside a git repository.", true);
        }
        return text(describeTabs(await readTabs(root), tabId, Date.now()));
    },
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
                "Only to update a tab that is not your current one, such as the one the user's review is about: its id (restitution_list shows them). Leave it out otherwise.",
            ),
            newTab: z
                .boolean()
                .optional()
                .describe(
                    "Open an additional tab for a different restitution instead of replacing your current one. The earlier tab stays; the new one becomes your current tab.",
                ),
        },
    },
    async ({ id, newTab, ...input }) => {
        const root = repoRoot();
        if (!root) {
            return text(
                "Not inside a git repository. Restitution compares the files with their last commit (git) to show what changed, so it needs one. Tell the user; they can create it with `git init`, or from the Restitution panel. Your code changes are unaffected.",
                true,
            );
        }
        if (id && newTab) {
            return text(
                "Give either id (update that tab) or newTab (open another), not both.",
                true,
            );
        }
        // A given id is the tab to update; either way it becomes this session's tab.
        const target = newTab ? newTabId() : (id ?? tabId ?? newTabId());
        const replacing = !newTab && (await readSaved(root, target)).ok;
        tabId = target;
        const report = await submitRestitution(root, target, {
            version: 1,
            ...input,
        });
        const where = newTab
            ? `This is a new tab (id: ${target}); your earlier tab stays as it was.`
            : replacing
              ? `It replaced the restitution that was in this tab (id: ${target}).`
              : `Tab id: ${target}.`;
        return text(`${report}\n${where}`);
    },
);

server.registerTool(
    "restitution_edit",
    {
        description:
            "Change part of a restitution you already submitted: change, split, add or remove steps and goals, without resubmitting the rest. Steps you don't mention stay exactly as they were. Reports coverage like restitution_submit, and the new step labels.",
        inputSchema: {
            id: TAB_ID.optional().describe(
                "The restitution to edit. Leave it out for your current tab; after the user's review, or for another tab (restitution_list), use its id.",
            ),
            edits: z
                .array(EditSchema)
                .min(1)
                .describe(
                    "Applied together; every label and goal number refers to the restitution as it was before these edits.",
                ),
            note: z
                .string()
                .min(1)
                .optional()
                .describe(
                    "One or two sentences for the user on what you changed in this update and why, shown at the top of their panel.",
                ),
        },
    },
    async ({ id, edits, note }) => {
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
        // The note is about this update only: one from before goes.
        const { note: _previous, ...rest } = result.value;
        const updated = note ? { ...rest, note } : rest;
        const report = await submitRestitution(root, target, updated);
        return text(`${report}\n\nThe steps are now:\n${outline(updated)}`);
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
        // A comment can follow up an earlier answer: give the agent those.
        const earlier = await readAnswers(root, id);
        const history =
            earlier.length === 0
                ? ""
                : `\n\nYour earlier answers on this restitution (a comment may follow up one of them):\n${earlier
                      .map(
                          (answer) =>
                              `- ${answer.label}: "${answer.comment}" -> "${answer.answer}"`,
                      )
                      .join("\n")}`;
        return text(
            `${FEEDBACK_GUIDE}\nThe id: ${id}\n\nThe restitution:\n${restitution}${history}`,
        );
    },
);

async function main(): Promise<void> {
    await server.connect(new StdioServerTransport());
}

void main();
