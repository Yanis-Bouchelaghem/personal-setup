# Restitution: design

A **restitution** is a short, ordered reading guide that the agent which made a change writes for the human who asked for it. The human reads it right after the turn, in a side panel, then reads the real code in the editor. It tells them **what to read, in what order, and why**. It never replaces reading the code.

Plan and milestones: `~/.claude/plans/eager-sauteeing-treehouse.md`. Architecture visualization is out of scope: it belongs in its own extension, so Restitution stays a reading guide.

## Decisions

- A JSON file is the contract between agent and viewer. The agent writes it through an MCP tool; writing the file by hand also works.
- Explanations live only in the side panel. "Open in editor" opens the native `vscode.diff` on demand.
- Each step after the first in a goal carries a connector word (`link`: free text, the word as shown, in the reader's language; default "then"). The page reads as one sentence: the next card's text continues after the word. The model chooses and translates the word; nothing checks it, so the panel works in any language, and because this is only a guide.
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
- Connector words, with the definition each agent is given: **then** (the default: builds on the previous step; stop before it and the code still works, just unfinished), **in parallel** (leave the step out and no other step notices), **which means** (a step with no code that states a consequence: behaviour that changes for users, operators or callers, or something that now has to happen), and **so**, only right after a **which means**: the code that deals with that consequence. A forced change (a new parameter, so the callers change) is said out loud that way, so the reader knows why the code changed. The guide defines the four in English and asks the agent to write the whole restitution, connector words included, in the user's language; nothing validates them. There are no connectors between goals.
- **Documentation references** (`docs: [{title, url}]` on a step): when a step relies on something specific about how a library, an API, a protocol or a tool behaves, the agent points to the exact section of its documentation (a deep link, official docs preferred, only addresses it is sure of). The title is a natural phrase saying what the reader learns there. The link sits under the `why` and opens in the browser; only http and https addresses are accepted, in the schema and again in the extension.
- **Examples** (`examples: [{title, body}]` on a step): anything concrete the diff does not show, as monospace text: mostly data that crosses the boundary with something outside the codebase (an external API's payload, a file format), and anything that saves the reader friction in trying the change themselves (the command to try it, the request to send, the config entry that turns it on, how to call it), or what it produces (CLI output, a response). The guide asks agents to be generous with those. Never a copy of code the diff shows. The agent puts one on the step it illustrates, so its place says what it is. Its title is a natural phrase saying what the data is and where it comes from ("An example of a plugin the marketplace API could return"), not a label. In the card it sits between the `why` and the code, folded to its title (no "Example" label: the title says it): deep blue folded, brighter blue open, both the theme's accent mixed into the editor background. Changing an example changes the step's fingerprint.
- No background and no "what to check".

### Exact lines

A step that points at code gives both `file` (relative to the git root) and `lines`, a list of `[from, to]` ranges. `lines` is required with `file`, and is **exactly what the card shows**: the panel cuts the step's diff down to those lines and nothing around them, so the model chooses what the reader sees. The editor, on the other hand, selects only what changed: the added or changed lines inside the shown ranges, one selection per contiguous run, so unchanged code between two changes stays unselected. A step that only removes code has nothing to select on the new side, so it selects its range.

- Ranges are on the new side of the file; for a deleted file, on the old side, the only one that exists.
- A removed line has no new-side number, so it sits with the line just before it (or at the start of its hunk). A range that includes that line shows the removal.
- Coverage is per changed line: `restitution_submit` lists the changed lines no step shows (any tab counts) and the steps whose lines hold no change. It's a hint, never a block.

## MCP

`src/mcp/server.ts` is a stdio server bundled to `dist/mcp-server.js`. The extension copies it to its global storage (a path that survives updates) and "Restitution: Connect agents" registers it with Claude Code (all projects, or this workspace only) and Codex. Copilot finds it through VS Code's MCP provider API. Tools:

- `restitution_guide`: the rules and format.
- `restitution_submit`: saves `.restitution/<id>.json` atomically (one tab per agent session), then reports changed hunks no step explains and steps pointing at unchanged code. It never blocks.
- `restitution_edit`: partial updates, so a guide is never rewritten whole for a small change. A list of edits applied together (`set` some fields of a step, `replace` a step with several, one or none, `insert` steps before or after one, `setGoal`, `removeGoal`, `addGoal`); every label refers to the numbering before the edit. Nothing applies if any edit is wrong. It reports coverage like submit, plus the new outline with fresh labels. Untouched steps keep their fingerprint, so the reader's Viewed marks survive.

## Trying it

- `npm run build && node scripts/mcp-smoke.mjs <repo>` drives the MCP server like an agent would.
- `scripts/make-sandbox.sh <dir> [clean]` builds a scratch repo from the files in `sandbox/` (`base/` as committed, `changes/` as changed, `deleted.txt`, and `restitutions/`, one file per tab). With `clean` it stops after the first commit, for an agent to change.
- `npm run dump:state -- <repo>` writes the panel's state for a repo, and `npm run webview:dev` then shows it in a browser at `/?state=/state.json`.

## Reviewing: comments, clarify, and what changed

Each step has two ways to ask: **Clarify** in its header (ask the agent to explain this step in smaller steps) and **Comment** under its code (a question or change request, typed in a box that takes the button's place, saved as you type). While anything is asked, a bar pinned to the bottom (it slides up when the first thing is asked and back down when nothing is left, and glows blue briefly each time something new is asked; removing or editing does not glow) sums it up ("1 step to clarify · 2 comments") with **Copy for agent** and **Reset**. The copied text is short, only what is asked:

```
My review of the restitution "Review fixes" (id: review-fixes):
- 2.1: "Why not keep the plain object and lowercase the key instead?"
- 3.1: clarify
```

How to handle it lives with the agent, not in the prompt: the `restitution_feedback` tool ("call this first when the user pastes their review") returns the rules and the restitution. The agent answers questions in its reply, makes requested code changes, and uses `restitution_edit` with the review's `"id"`: it replaces each clarified step with smaller ones and changes only the steps the comments are about, so everything else stays read. MCP gives no way for the panel to make an agent act, so pasting is the trigger.

All of it lives in `<id>.review.json`, written only by the extension: `viewed`, `known` (steps the reader was already shown) and `requests`.

- **Code changed since explained.** On every submit and edit, the MCP server saves `<id>.code.json`: a digest of each step's changed lines (no line numbers, no context), keyed by step fingerprint. The panel compares it with the current diff and, when a step's code differs, shows a warning triangle in its header and a note above its explanation ("This code changed after it was explained, so the explanation may be out of date."). Before refreshing the snapshot, the server tells the agent which steps' code changed since it explained them, so it can check them. Steps the snapshot has never seen (a tab from before snapshots, or written by an older server) get the code the panel first sees as their baseline, so hand edits after that still show. A step whose changes are gone (committed) shows that on its own and is not flagged.
- **Updated steps.** A step's fingerprint covers what the agent wrote: file, line ranges, words, connector, examples and docs, not the code under it (code changes have their own warning, below), so editing code never resets what you viewed. On the first look at a tab every step becomes known; later, any step whose fingerprint isn't known (new, or changed by the agent) gets an even yellow ring, its goal (and its overview row) gets a yellow "Updated" pill, and it comes back unfolded even if it was viewed. Resting the pointer on it for half a second, or viewing it, makes it known.
- **Requests close themselves.** Copying marks the requests sent; once the agent rewrites the tab after that, they are hidden as answered. Editing a request un-sends it.

## Panel layout

- **No git repository**: the panel says why git is needed (it compares the files with their last commit, for any language) and offers to create a repository in the open folder (`git init`, no dialog). The extension looks for a repository again whenever the window gets focus, so one created any other way is picked up without a reload. The MCP server refuses to save outside a repository and tells the agent to pass that on.
- **Changed, but in no guide**: the end of every tab lists the uncommitted lines no step of any guide shows, one card per file, in a folded section with a dashed header (and a matching row in the overview). Each card folds from its header, and a click on it (the code included, since there is no explanation) opens the file with those changes selected; Diff and File sit at the right. The agent gets the same list when it submits; this shows it to the reader too, so a guide that leaves something out can't hide it. It is a plain line diff from git, so it works for any language.
- **Narrow side bars** (inspired by GitLens): label rows never wrap. Goal titles, overview rows, file names, connector words and the tab labels stay on one line and end in "…", with the full text on hover. Prose (the explanation, examples, comments) keeps wrapping. Code wraps at spaces, and a word longer than the line scrolls sideways instead of breaking letter by letter. Below about 260px the rail indent shrinks; on a very narrow card the header drops the file name to keep its buttons, and the feedback bar drops its summary.
- **Tabs** along the top, one per restitution file. When they don't fit (each keeps room for a word or two), arrows on both sides page through them, the strip fades where tabs are hidden, the mouse wheel scrolls it sideways, and the active tab is kept in view. An arrow at its end greys out rather than disappearing.
- **Overview** (from two goals up): the goals with their progress, and a click jumps to one, unfolding it first.
- **Goals** are foldable: the whole header is the control. Folding keeps the header where it was, so nothing jumps. A goal whose steps are all viewed folds itself (and starts folded); it unfolds again if the agent changes one of its steps. Folding or unfolding by hand wins until then.
- **Steps** hang on a rail inside their goal, under its chevron. The line runs from the first step's dot to the last one's, and every dot sits on it, level with its card's header (ring; filled once viewed; yellow when updated; accent while hovered). Line and dots are placed from the same CSS variables. Between two cards sits one prominent connector word, so the goal reads as a sentence.
- **Opening and closing animate** (steps, goals, examples): the content grows from nothing to its height and fades in, over about 0.2 s. It snaps instead when the header being clicked is pinned (the box's top is scrolled away), because the page has to scroll at the same moment to keep that header in place, and under reduced motion.
- **Viewed** folds a step to its header; the whole step header toggles it (its chevron is the keyboard control). There is no checkbox: a viewed step shows as folded, its number struck through and its rail node filled.
- **Clicking a step** anywhere but its header, its inline diff, a button or the comment opens the file with the changes selected (nothing, for a deleted file). Ending a text selection does not count. Those parts glow on hover, with the same tint as the header, so it is clear what a click will do.
- **Header**: chevron, number, file, Clarify, then Diff and File at the right end. Diff and File stay on folded steps; a text-only step has neither, so Clarify ends its header. One a step cannot use is greyed out, and its tooltip says why: Diff for a new or deleted file (there is only one side to compare), File for a deleted file, both when the lines have no uncommitted changes. Nothing moves from card to card. Buttons show a one-word label next to their icon for as long as the file name still fits whole: as the card narrows, the folder gives way first, then the labels, and the name last (on a narrow card the chip drops its folder altogether).
