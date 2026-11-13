# Restitution VS Code extension

Read `docs/DESIGN.md` first: it holds the decisions, the file format and the writing rules.

## Commands

- `npm run check`: format, lint, typecheck, tests. Run it before saying anything is done.
- `npm run build`: bundles the extension (esbuild) and the webview (Vite) into `dist/`.
- `npm run webview:dev`: the React app in a browser, with fixtures and a theme switcher.
- `npm run shots`: screenshots of the harness in `.shots/` for visual review.
- `npm run dump:state -- <repo>`: the panel's state for a repo, viewable in the harness at `/?state=/state.json`.
- `scripts/make-sandbox.sh <dir>`: a scratch repo with uncommitted changes and restitutions, built from `sandbox/`.
- F5 ("Run Extension") opens a dev window on this repo.

## Rules

- Keep it simple: no abstraction without a second real case, and no backward-compatibility code: this is a young tool, so change formats freely.
- Small modules with one job. `src/node/store/` is one file per concern (paths, files, exclude, review, tabs, archive, viewState); webview state lives in hooks (`useViewed`, `useGoalFolding`, `useUnread`).
- `src/core` is pure TypeScript. It must not import `vscode`, `node:*` or other layers (oxlint enforces it).
- TypeScript stays on 6.x: the sonarjs lint plugin breaks on the 7.x native compiler.
- Colours come from `--vscode-*` variables only.
- The user reviews every milestone visually before the next one starts.
- **Commit often**: small logical commits, each with `npm run check` green. End messages with the `Co-Authored-By` line.
