# dotfiles

Instructions for Claude (or me) to set up a machine. Start with the installer at the repo root: `.\install.ps1` on Windows (once, as your user: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`), `bash install.sh` on macOS. It installs the tools, copies the files below, adds the cursor-trail loader setting and installs the VS Code extensions. It asks before replacing a file that differs (keeping the old one as `<name>.bak`), and `-DryRun` / `--dry-run` shows what it would do. Then do what is left in the sections below. Keep the scripts small: they only install tools and copy files; judgement calls stay here in prose.

## Files

| File | macOS | Windows |
|---|---|---|
| `nvim/init.lua` (vscode-neovim) | `~/.config/nvim/init.lua` | `%LOCALAPPDATA%\nvim\init.lua` |
| `vscode/keybindings.mac.json` | `~/Library/Application Support/Code/User/keybindings.json` | not used |
| `vscode/keybindings.windows.json` | not used | `%APPDATA%\Code\User\keybindings.json` |
| `vscode/cursor-trail/cursor-trail.js` | injected into VS Code, not copied: see "Cursor trail" | same |

Symlink instead of copying if I want edits in VS Code or Neovim to land in this repo (Windows needs Developer Mode for that). The Windows keybindings are the Mac ones with `cmd` as `ctrl`, and the default bindings they remove use their Windows keys. When one file changes, mirror it in the other.

## Tools to have

Git, Node LTS, Neovim, VS Code (with the `code` command on the PATH), GitHub CLI, Claude Code (`npm install -g @anthropic-ai/claude-code`, then log in). Windows: `winget install Git.Git OpenJS.NodeJS.LTS Neovim.Neovim Microsoft.VisualStudioCode GitHub.cli`.

## VS Code

Turn on Settings Sync with my personal GitHub account (it carries settings, extensions and, per platform, keybindings). Never sign sync in with the work account: `settings.json` holds internal URLs.
## Cursor trail

The glowing trail behind the cursor in VS Code. It is a script loaded through the Custom CSS and JS Loader extension, not
an extension of its own. Follow `vscode/cursor-trail/README.md`; the short version:

- Install `be5invis.vscode-custom-css`, copy `vscode/cursor-trail/cursor-trail.js` to `~/.vscode-cursor-trail/cursor-trail.js` (the clone can be anywhere), and set `vscode_custom_css.imports` to `file://${userHome}/.vscode-cursor-trail/cursor-trail.js`. That one value is right on both OSes and is meant to sync. Copy again after the script changes.
- The user must run "Enable Custom CSS and JS" in the Command Palette and restart VS Code; Claude cannot do that part.
- Expect `[Unsupported]` in the title bar. A VS Code update removes the patch, so run "Reload Custom CSS and JS" again.

## The Restitution extension

From `../restitution-extension`: `npm ci && npm run install:local`, then in VS Code run "Restitution: Connect agents". Its shortcut for the panel is `cmd+r` on macOS and `ctrl+r` elsewhere.

## Firefox

Sign in to Firefox Sync with Add-ons on, and enable sync inside Vimium C. `vimium-c/` is where an exported settings backup goes. Mappings written with `<m-…>` (Cmd) become `<c-…>` on Windows.
