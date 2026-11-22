// Drive the bundled MCP server like an agent would.
// Usage: node scripts/mcp-smoke.mjs <repo>   (run `npm run build` first)
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = process.argv[2];
if (!repo) {
    throw new Error("usage: mcp-smoke.mjs <repo>");
}

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(
    new StdioClientTransport({
        command: "node",
        args: [new URL("../dist/mcp-server.js", import.meta.url).pathname],
        cwd: repo,
    }),
);

console.log("instructions:\n", client.getInstructions(), "\n");
const { tools } = await client.listTools();
console.log("tools:", tools.map((tool) => tool.name).join(", "));

const guide = await client.callTool({
    name: "restitution_guide",
    arguments: {},
});
console.log("guide starts:", guide.content[0].text.split("\n")[0]);

const submit = (args) =>
    client.callTool({ name: "restitution_submit", arguments: args });
const show = (label, result) =>
    console.log(
        `${label}${result.isError ? " [error]" : ""}:\n${result.content[0].text}\n`,
    );

show(
    "partial (only one file explained)",
    await submit({
        goals: [
            {
                title: "Reject plain-http Apigee URLs",
                steps: [
                    {
                        file: "src/config.ts",
                        lines: [[1, 12]],
                        why: "Require https, so tokens never leave in clear text.",
                    },
                    {
                        file: "src/nope.ts",
                        lines: [[1, 3]],
                        why: "Point at a file that did not change, to see the warning.",
                    },
                ],
            },
        ],
    }),
);
show(
    "invalid (no steps)",
    await submit({ goals: [{ title: "Empty", steps: [] }] }),
);
// Same session, same tab: a second submit replaces the first.
show(
    "again (replaces my tab)",
    await submit({
        label: "Smoke test",
        goals: [
            {
                title: "Reject plain-http Apigee URLs",
                steps: [
                    {
                        file: "src/config.ts",
                        lines: [[1, 12]],
                        why: "Require https, so tokens never leave in clear text.",
                    },
                ],
            },
        ],
    }),
);
// Partial updates: split a step, then try an edit that names a missing step.
const edit = (edits) =>
    client.callTool({ name: "restitution_edit", arguments: { edits } });
show(
    "edit (split 1.1, add a goal)",
    await edit([
        {
            op: "replace",
            step: "1.1",
            steps: [
                {
                    file: "src/config.ts",
                    lines: [[1, 6]],
                    why: "Parse the URL first.",
                },
                {
                    file: "src/config.ts",
                    lines: [[7, 12]],
                    link: "then",
                    why: "reject anything but https.",
                },
            ],
        },
        {
            op: "addGoal",
            goal: { title: "Docs", steps: [{ why: "Say it in the README." }] },
        },
    ]),
);
show(
    "edit (a step that does not exist)",
    await edit([{ op: "set", step: "4.2", fields: { why: "nope." } }]),
);
console.log("files:", readdirSync(join(repo, ".restitution")).join(", "));
await client.close();
