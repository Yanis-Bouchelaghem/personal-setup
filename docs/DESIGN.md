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

1. **Goals come from the request, in its words.** Six fixes asked means six goals. Extra work you did gets its own goal, honestly titled ("Unrequested: ...").
2. **Goals are independent changesets.** One goal can be read, reviewed and reverted without the others. Goals are numbered by position; `ref` is an optional label from the request.
3. **Steps follow the order a competent engineer would have worked:** usually the change that forces the others comes first, the fix before its test. Default to one step per goal, at most three.
4. **A test goes in the same step as the code it proves**, never in a separate goal.
5. **`why` is one sentence, 15 words at most, shaped "action, then reason":** what was done, then why. "Set Authorization through Headers, because a plain object kept both casings." Never "Before it did X, now it does Y".
6. **`because` is optional.** Add it only when a reader would otherwise wonder why this step exists or why it comes next. Independent steps get none.
7. **No background and no "what to check".** The reader knows the codebase and the request.
8. **Write the ideal path, not your history.** When the code changes again, rewrite the story instead of appending "then I fixed ...".
