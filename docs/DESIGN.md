# Restitution: design

A **restitution** is a short, ordered reading guide that the agent which made a change writes for the human who asked for it. The human reads it right after the turn, in a side panel, then reads the real code in the editor. It tells them **what to read, in what order, and why**. It never replaces reading the code.

Plan and milestones: `~/.claude/plans/eager-sauteeing-treehouse.md` (scroll mode first, then immersive mode and the architecture graph).

## Decisions

- A JSON file is the contract between agent and viewer. The agent writes it through an MCP tool; writing the file by hand also works.
- Explanations live only in the side panel. "Open in editor" opens the native `vscode.diff` on demand.
- Each step after the first in a goal carries a connector word (`link`: then, so or in parallel; default then). The page reads as one sentence: the next card's text continues after the word. The model chooses the word; nothing checks it, because this is only a guide.
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

In `<gitRoot>/.restitution/` (the git root can sit above the workspace folder), **one file per restitution**, shown as one tab each:

- `<id>.json`: the agent's content. Each MCP server process (one per agent session) makes its own id on its first submit and replaces that file on later submits, so concurrent agents never overwrite each other. Any `*.json` here is a tab (a hand-written `working.json` works too).
- `<id>.review.json`: the human's review (Viewed, steps already shown, comments and steps to clarify), written only by the extension. It moves with its tab into the archive and back.
- `archive/`: closing a tab moves its file here, with no confirmation (a modal is too heavy and not keyboard friendly; the way back is the safety net). The clock button at the end of the tab strip, or "Restitution: Reopen closed tab", lists them (most recently closed first, using the file's ctime) and brings one back, selected. If the agent wrote a new file with the same id in the meantime, the old one comes back under a free id.

The tab name is `label`, else `request`, else the first goal. The extension keeps `.restitution/` out of `git status` through `.git/info/exclude`. A hunk counts as explained when any tab covers it, so coverage warnings don't blame one agent for another's files.

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
                    "lines": [[7, 17]],
                    "why": "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text."
                },
                {
                    "file": "src/marketplace/marketplaceRewriter.ts",
                    "lines": [
                        [1, 4],
                        [8, 20]
                    ],
                    "link": "so",
                    "why": "rewrite only the plugins that parsed, and keep the skipped count."
                }
            ]
        }
    ]
}
```

## Writing rules (for the agent)

The rules agents follow live in `src/core/guide.ts`: it is both what the MCP server sends as `instructions` and what `restitution_guide` returns, so there is one source of truth. In short:

- Goals come from the request. **A goal stands on its own and could be reverted without touching another goal**; parts that only make sense together (a feature with its config, tests and docs) are one goal with several steps. There is no limit on steps: the model should teach well, and the user can ask for more or less detail.
- A step's `why` is one short sentence, action then reason. The first step of a goal starts the sentence; every other step continues after its connector word, so the goal reads aloud as one sentence.
- Connector words, with the definition each agent is given: **then** (the default: comes after and builds on the previous step), **so** (the previous step forces this one), **in parallel** (independent of the previous step, readable in either order). There are no connectors between goals.
- No background and no "what to check".

### Exact lines

A step that points at code gives both `file` (relative to the git root) and `lines`, a list of `[from, to]` ranges. `lines` is required with `file`, and is **exactly what the card shows**: the panel cuts the step's diff down to those lines and nothing around them, so the model chooses what the reader sees. The editor, on the other hand, selects only what changed: the added or changed lines inside the shown ranges, one selection per contiguous run, so unchanged code between two changes stays unselected. A step that only removes code has nothing to select on the new side, so it selects its range.

- Ranges are on the new side of the file; for a deleted file, on the old side, the only one that exists.
- A removed line has no new-side number, so it sits with the line just before it (or at the start of its hunk). A range that includes that line shows the removal.
- Coverage is per changed line: `restitution_submit` lists the changed lines no step shows (any tab counts) and the steps whose lines hold no change. It's a hint, never a block.

## MCP

`src/mcp/server.ts` is a stdio server bundled to `dist/mcp-server.js`. The extension copies it to its global storage (a path that survives updates) and "Restitution: Connect agents" registers it with Claude Code (all projects, or this workspace only) and Codex. Copilot finds it through VS Code's MCP provider API. Tools:

- `restitution_guide`: the rules and format.
- `restitution_submit`: saves `.restitution/working.json` atomically, then reports changed hunks no step explains and steps pointing at unchanged code. It never blocks.

## Trying it

- `npm run build && node scripts/mcp-smoke.mjs <repo>` drives the MCP server like an agent would.
- `scripts/make-sandbox.sh <dir> [clean]` builds a scratch repo from the files in `sandbox/` (`base/` as committed, `changes/` as changed, `deleted.txt`, and `restitutions/`, one file per tab). With `clean` it stops after the first commit, for an agent to change.
- `npm run dump:state -- <repo>` writes the panel's state for a repo, and `npm run webview:dev` then shows it in a browser at `/?state=/state.json`.

## Reviewing: comments, clarify, and what changed

Each step header has, next to the diff and file buttons, two toggles: **Clarify** (ask the agent to explain this step in smaller steps) and **Comment** (a question or change request, typed in a box under the step). While anything is asked, a bar pinned to the bottom sums it up ("1 step to clarify · 2 comments") with **Copy for agent** and **Reset**. The copied text is short, only what is asked:

```
My review of the restitution "Review fixes" (id: review-fixes):
- 2.1: "Why not keep the plain object and lowercase the key instead?"
- 3.1: clarify
```

How to handle it lives with the agent, not in the prompt: the `restitution_feedback` tool ("call this first when the user pastes their review") returns the rules and the restitution. The agent answers questions in its reply, makes requested code changes, splits steps to clarify, keeps every other step word for word, and resubmits with `"id"` so the same tab updates. MCP gives no way for the panel to make an agent act, so pasting is the trigger.

All of it lives in `<id>.review.json`, written only by the extension: `viewed`, `known` (steps the reader was already shown) and `requests`.

- **Updated steps.** A step's fingerprint covers its words, connector, file and changed lines. On the first look at a tab every step becomes known; later, any step whose fingerprint isn't known (new, or changed by the agent) gets a yellow tick and border, a yellow dot on its goal and in the overview, and comes back unfolded even if it was viewed. Viewing it makes it known.
- **Requests close themselves.** Copying marks the requests sent; once the agent rewrites the tab after that, they are hidden as answered. Editing a request un-sends it.

## Panel layout

- **Tabs** along the top, one per restitution file.
- **Overview** (from two goals up): the goals with their progress, and a click jumps to one, unfolding it first.
- **Goals** are foldable: the whole header is the control. Folding keeps the header where it was, so nothing jumps. A goal whose steps are all viewed folds itself (and starts folded); it unfolds again if the agent changes one of its steps. Folding or unfolding by hand wins until then.
- **Steps** hang on a rail inside their goal. Between two cards sits one prominent connector word, so the goal reads as a sentence.
- **Viewed** folds a step to its header; the whole step header toggles it.
- **Header buttons** (Diff, File, Clarify, Comment) show a one-word label next to their icon when the card is wide enough (a container query on the card), and only the icon otherwise.
