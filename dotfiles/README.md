# dotfiles

Instructions for Claude (or me) to set up a machine. Do the steps for the current OS, ask before overwriting an existing file (keep it as `<name>.bak`), and prefer copying files over writing scripts.

## Files

| File | macOS | Windows |
|---|---|---|
| `nvim/init.lua` (vscode-neovim) | `~/.config/nvim/init.lua` | `%LOCALAPPDATA%\nvim\init.lua` |
| `vscode/keybindings.mac.json` | `~/Library/Application Support/Code/User/keybindings.json` | not used |
| `vscode/keybindings.windows.json` | not used | `%APPDATA%\Code\User\keybindings.json` |

Symlink instead of copying if I want edits in VS Code or Neovim to land in this repo (Windows needs Developer Mode for that). The Windows keybindings are the Mac ones with `cmd` as `ctrl`, and the default bindings they remove use their Windows keys. When one file changes, mirror it in the other.

## Tools to have

Git, Node LTS, Neovim, VS Code (with the `code` command on the PATH), GitHub CLI, Claude Code (`npm install -g @anthropic-ai/claude-code`, then log in). Windows: `winget install Git.Git OpenJS.NodeJS.LTS Neovim.Neovim Microsoft.VisualStudioCode GitHub.cli`.

## VS Code

Turn on Settings Sync with my personal GitHub account (it carries settings, extensions and, per platform, keybindings). Never sign sync in with the work account: `settings.json` holds internal URLs. Install the MesloLGS NF font (the terminal uses it).

## The Restitution extension

From `../restitution-extension`: `npm ci && npm run install:local`, then in VS Code run "Restitution: Connect agents". Its shortcut for the panel is `cmd+r` on macOS and `ctrl+r` elsewhere.

## Firefox

Sign in to Firefox Sync with Add-ons on, and enable sync inside Vimium C. `vimium-c/` is where an exported settings backup goes. Mappings written with `<m-…>` (Cmd) become `<c-…>` on Windows.
