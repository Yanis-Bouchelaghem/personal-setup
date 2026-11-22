# personal-setup

My tools and editor setup, the same on macOS and Windows.

- `restitution-extension/`: the Restitution VS Code extension (see its `docs/DESIGN.md`).
- `dotfiles/`: Neovim, VS Code keybindings, the VS Code cursor trail and Vimium C, with a README meant to be handed to Claude on a new machine.

On a new machine, clone this repo and run the installer. It asks before replacing anything and keeps `.bak` copies:

- Windows (once, as your user: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`): `.\install.ps1`
- macOS: `bash install.sh`

`-DryRun` (Windows) or `--dry-run` (macOS) shows what it would do first. It ends with the few steps nobody can script
(Settings Sync sign-in, "Enable Custom CSS and JS", Firefox Sync). To have Claude finish or adjust things, open Claude Code
in the repo and say "finish the setup from dotfiles/README.md". To add only the cursor trail: "install the cursor trail
from dotfiles/vscode/cursor-trail/README.md".
