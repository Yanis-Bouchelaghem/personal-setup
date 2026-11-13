# Restitution: design

A **restitution** is a short, ordered reading guide that the agent which made a change writes for the human who asked for it. The human reads it right after the turn, in a side panel, then reads the real code in the editor. It tells them **what to read, in what order, and why**. It never replaces reading the code.

Plan and milestones: `~/.claude/plans/eager-sauteeing-treehouse.md` (scroll mode first, then immersive mode and the architecture graph).

## Decisions

- A JSON file is the contract between agent and viewer. The agent writes it through an MCP tool; writing the file by hand also works.
- Explanations live only in the side panel. "Open in editor" opens the native `vscode.diff` on demand.
- Causality ("because of the previous step") is an optional field the model writes when it helps the reader. Nothing derives it.
- The explanation is optional. Nothing blocks a commit or a turn.
- MCP transport is **stdio** with the official SDK: the agent spawns it in the project folder, so it finds the repo for free, with no port, token or stale URL.
- Colours come only from VS Code theme variables. "Glass" is a light touch on cards and sticky headers.

## Layout

```
src/core/       pure TypeScript, no vscode/node imports (enforced by oxlint)
src/node/       node-only helpers shared by the extension and the MCP server
src/extension/  activate, file watcher, webview provider
src/mcp/        stdio MCP server (milestone 1)
src/webview/    React app; `npm run webview:dev` runs it in a browser with fixtures
```

## Files

In `<gitRoot>/.restitution/` (the git root can sit above the workspace folder):

- `working.json`: the agent's content (this file).
- `working.review.json`: the human's Viewed state and notes (later). Separate, so an agent rewriting its restitution never wipes review state.

The extension keeps `.restitution/` out of `git status` through `.git/info/exclude`.

```json
{
    "version": 1,
    "request": "/code-review --fix",
    "goals": [
        {
            "title": "Reject plain-http Apigee URLs",
            "ref": "#1",
            "steps": [
                {
                    "file": "src/config.ts",
                    "why": "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text."
                },
                {
                    "file": "src/marketplace/marketplaceRewriter.ts",
                    "why": "Check each plugin on its own, to drop only the bad ones.",
                    "because": "Needs the looser schema first, otherwise every plugin is still rejected."
                }
            ]
        }
    ]
}
```

## Writing rules (for the agent)

The rules agents follow live in `src/core/guide.ts`: it is both what the MCP server sends as `instructions` and what `restitution_guide` returns, so there is one source of truth. In short: goals come from the request and are independent changesets; one short action-then-reason sentence per step; a test goes in the same step as its code; `because` only when it helps the reader; no background, no "what to check".

`file` is relative to the git root. `lines` is an optional `[from, to]` on the new side, to pick one hunk of a big file.

## MCP

`src/mcp/server.ts` is a stdio server bundled to `dist/mcp-server.js`. The extension copies it to its global storage (a path that survives updates) and "Restitution: Connect agents" registers it with Claude Code (all projects, or this workspace only) and Codex. Copilot finds it through VS Code's MCP provider API. Tools:

- `restitution_guide`: the rules and format.
- `restitution_submit`: saves `.restitution/working.json` atomically, then reports changed hunks no step explains and steps pointing at unchanged code. It never blocks.

`npm run build && node scripts/mcp-smoke.mjs <repo>` drives the server like an agent would. `scripts/make-sandbox.sh <dir> [clean]` builds a scratch repo to test on.
