# Restitution VS Code extension

Read `docs/DESIGN.md` first: it holds the decisions, the file format and the writing rules.

## Commands

- `npm run check`: format, lint, typecheck, tests. Run it before saying anything is done.
- `npm run build`: bundles the extension (esbuild) and the webview (Vite) into `dist/`.
- `npm run webview:dev`: the React app in a browser, with fixtures and a theme switcher.
- `npm run shots`: screenshots of the harness in `.shots/` for visual review.
- F5 ("Run Extension") opens a dev window on this repo.

## Rules

- Keep it simple: no abstraction without a second real case.
- `src/core` is pure TypeScript. It must not import `vscode`, `node:*` or other layers (oxlint enforces it).
- TypeScript stays on 6.x: the sonarjs lint plugin breaks on the 7.x native compiler.
- Colours come from `--vscode-*` variables only.
- The user reviews every milestone visually before the next one starts.
- **Commit often**: small logical commits, each with `npm run check` green. End messages with the `Co-Authored-By` line.
