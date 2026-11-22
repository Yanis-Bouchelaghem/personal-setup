#!/usr/bin/env bash
# Sets up this Mac from the personal-setup repo.
#
# Installs missing tools with Homebrew, copies the Neovim init and the VS Code keybindings, puts the cursor-trail
# script in ~/.vscode-cursor-trail, adds the Custom CSS and JS Loader setting to VS Code's settings.json when it is
# missing, and installs the VS Code extensions (the loader, vscode-neovim, Restitution).
#
# Safe to run again. Nothing is overwritten without asking: a file that differs is replaced only after a "y" (or with
# --yes), and the old one is kept next to it as .bak. Use --dry-run to see what would happen without changing anything.
#
# Usage: bash install.sh [--dry-run] [--yes] [--skip-tools] [--skip-extensions] [--skip-restitution]
set -euo pipefail

DRY_RUN=0
YES=0
SKIP_TOOLS=0
SKIP_EXTENSIONS=0
SKIP_RESTITUTION=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --skip-tools) SKIP_TOOLS=1 ;;
    --skip-extensions) SKIP_EXTENSIONS=1 ;;
    --skip-restitution) SKIP_RESTITUTION=1 ;;
    -h | --help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# PERSONAL_SETUP_OS exists only so the file logic can be tested on another OS.
OS="${PERSONAL_SETUP_OS:-$(uname -s)}"
case "$OS" in
  Darwin | mac) ;;
  *) echo "install.sh is for macOS. On Windows, run install.ps1." >&2; exit 1 ;;
esac

VSCODE_USER="$HOME/Library/Application Support/Code/User"
LOADER_KEY='vscode_custom_css.imports'
LOADER_VALUE='file://${userHome}/.vscode-cursor-trail/cursor-trail.js'
MANUAL=()

say() { printf '%-6s %s\n' "$1" "$2"; }
have() { command -v "$1" > /dev/null 2>&1; }

backup_path() {
  local backup="$1.bak"
  if [ -e "$backup" ]; then backup="$1.bak-$(date +%Y%m%d-%H%M%S)"; fi
  printf '%s' "$backup"
}

find_code() {
  if have code; then command -v code; return 0; fi
  local app="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
  if [ -x "$app" ]; then printf '%s' "$app"; return 0; fi
  return 1
}

# --- tools -------------------------------------------------------------------------------------------------------

brew_install() { # <command to look for> <brew arguments...>
  local command_name="$1"
  shift
  if have "$command_name"; then say ok "$command_name is installed"; return; fi
  if [ "$DRY_RUN" -eq 1 ]; then say would "brew install $*"; return; fi
  say do "brew install $*"
  brew install "$@" || { say warn "brew could not install $*"; MANUAL+=("Install $* with Homebrew"); }
}

install_tools() {
  if ! have brew; then
    say warn 'Homebrew is missing'
    MANUAL+=('Install Homebrew from https://brew.sh, then run install.sh again')
    return
  fi
  brew_install git git
  brew_install node node # Homebrew's node is the current release, not the LTS line
  brew_install nvim neovim
  brew_install gh gh
  if find_code > /dev/null; then
    say ok 'VS Code is installed'
  elif [ "$DRY_RUN" -eq 1 ]; then
    say would 'brew install --cask visual-studio-code'
  else
    say do 'brew install --cask visual-studio-code'
    brew install --cask visual-studio-code || { say warn 'could not install VS Code'; MANUAL+=('Install VS Code'); }
  fi

  if have claude; then say ok 'claude is installed'; return; fi
  if [ "$DRY_RUN" -eq 1 ]; then say would 'npm install -g @anthropic-ai/claude-code'; return; fi
  if have npm; then
    say do 'npm install -g @anthropic-ai/claude-code'
    npm install -g @anthropic-ai/claude-code || { say warn 'Claude Code install failed'; MANUAL+=('Install Claude Code: npm install -g @anthropic-ai/claude-code'); }
  else
    say warn 'npm not found, cannot install Claude Code'
    MANUAL+=('Install Claude Code: npm install -g @anthropic-ai/claude-code')
  fi
}

# --- files -------------------------------------------------------------------------------------------------------

install_file() { # <source> <target>
  local source="$1" target="$2" answer backup
  if [ ! -f "$source" ]; then echo "missing in the repo: $source" >&2; exit 1; fi
  if [ -e "$target" ]; then
    if cmp -s "$source" "$target"; then say ok "$target is up to date"; return; fi
    if [ "$DRY_RUN" -eq 1 ]; then say would "replace $target (the old one is kept as .bak)"; return; fi
    if [ "$YES" -ne 1 ]; then
      if [ -t 0 ]; then
        read -r -p "$target differs from the repo copy. Replace it (the old one is kept as .bak)? [y/N] " answer
        case "$answer" in y | Y | yes | YES) ;; *) say skip "left $target alone"; return ;; esac
      else
        say skip "$target differs from the repo copy; run again with --yes to replace it"
        MANUAL+=("Replace $target with $source (run install.sh --yes)")
        return
      fi
    fi
    backup="$(backup_path "$target")"
    cp "$target" "$backup"
    say bak "$target -> $backup"
  elif [ "$DRY_RUN" -eq 1 ]; then
    say would "create $target"
    return
  fi
  mkdir -p "$(dirname "$target")"
  cp "$source" "$target"
  say done "copied to $target"
}

# VS Code's settings.json is JSON with comments and trailing commas, so only add the one line, right after the
# opening brace, and never touch a value that is already there.
set_loader_setting() {
  local file="$VSCODE_USER/settings.json" entry backup
  entry="$(printf '"%s": ["%s"]' "$LOADER_KEY" "$LOADER_VALUE")"

  if [ ! -f "$file" ] || ! grep -q '[^[:space:]]' "$file"; then
    if [ "$DRY_RUN" -eq 1 ]; then say would "create $file with the Custom CSS and JS Loader setting"; return; fi
    mkdir -p "$(dirname "$file")"
    printf '{\n\t%s\n}\n' "$entry" > "$file"
    say done "created $file with the loader setting"
    return
  fi

  if grep -q "\"$LOADER_KEY\"" "$file"; then
    if grep -qF "$LOADER_VALUE" "$file"; then
      say ok 'settings.json already points the loader at the cursor trail'
    else
      say warn "settings.json has $LOADER_KEY with another value; left alone"
      MANUAL+=("Set $LOADER_KEY to [\"$LOADER_VALUE\"] in settings.json")
    fi
    return
  fi

  if ! grep -Eq '^[[:space:]]*\{[[:space:]]*$' "$file"; then
    say warn 'could not find the opening brace of settings.json; left alone'
    MANUAL+=("Add $entry to settings.json")
    return
  fi
  if [ "$DRY_RUN" -eq 1 ]; then say would "add $LOADER_KEY to $file (the old file is kept as .bak)"; return; fi
  backup="$(backup_path "$file")"
  cp "$file" "$backup"
  say bak "$file -> $backup"
  LINE="$(printf '\t%s,' "$entry")" perl -0pi -e 's/^([ \t]*\{[ \t]*\r?\n)/$1 . $ENV{LINE} . "\n"/me' "$file"
  say done "added $LOADER_KEY to $file"
}

# --- extensions --------------------------------------------------------------------------------------------------

install_extensions() {
  local code installed id
  if ! code="$(find_code)"; then
    say warn "VS Code's code command not found; extensions skipped"
    MANUAL+=('Install VS Code, then run install.sh again')
    return
  fi
  installed="$("$code" --list-extensions 2> /dev/null || true)"
  for id in be5invis.vscode-custom-css asvetliakov.vscode-neovim; do
    if grep -qix "$id" <<< "$installed"; then say ok "$id is installed"; continue; fi
    if [ "$DRY_RUN" -eq 1 ]; then say would "code --install-extension $id"; continue; fi
    say do "code --install-extension $id"
    "$code" --install-extension "$id"
  done
}

install_restitution() {
  local code
  if ! have npm || ! code="$(find_code)"; then
    say warn 'node or VS Code is missing; Restitution skipped'
    MANUAL+=('Install Restitution: cd restitution-extension && npm ci && npm run install:local')
    return
  fi
  if [ "$DRY_RUN" -eq 1 ]; then say would "npm ci and npm run install:local in $REPO/restitution-extension"; return; fi
  (
    cd "$REPO/restitution-extension"
    PATH="$(dirname "$code"):$PATH" # install:local runs the `code` command
    say do 'npm ci (restitution-extension)'
    npm ci
    say do 'npm run install:local'
    npm run install:local
  ) || { say warn 'Restitution install failed'; MANUAL+=('Install Restitution: cd restitution-extension && npm ci && npm run install:local'); }
}

# --- run ---------------------------------------------------------------------------------------------------------

say repo "$REPO"
if [ "$DRY_RUN" -eq 1 ]; then say note 'dry run: nothing will be changed'; fi

if [ "$SKIP_TOOLS" -eq 1 ]; then say skip tools; else install_tools; fi

install_file "$REPO/dotfiles/nvim/init.lua" "$HOME/.config/nvim/init.lua"
install_file "$REPO/dotfiles/vscode/keybindings.mac.json" "$VSCODE_USER/keybindings.json"
install_file "$REPO/dotfiles/vscode/cursor-trail/cursor-trail.js" "$HOME/.vscode-cursor-trail/cursor-trail.js"
set_loader_setting

if [ "$SKIP_EXTENSIONS" -eq 1 ]; then
  say skip 'VS Code extensions'
else
  install_extensions
  if [ "$SKIP_RESTITUTION" -eq 1 ]; then say skip Restitution; else install_restitution; fi
fi

echo
if [ "${#MANUAL[@]}" -gt 0 ]; then
  echo 'Needs your attention:'
  for item in "${MANUAL[@]}"; do echo "  - $item"; done
  echo
fi
cat << 'EOF'
Still to do by hand (a script cannot):
  - VS Code: sign in to Settings Sync with the PERSONAL GitHub account only, never the work account.
  - VS Code: Command Palette > "Enable Custom CSS and JS", then restart VS Code (the title bar will say [Unsupported]: harmless).
    If it fails with a permission error, VS Code's install folder must be writable by you: follow the loader's README (a chown).
  - VS Code: Command Palette > "Restitution: Connect agents".
  - Run "claude" and "gh auth login" once to sign in.
  - Firefox: sign in to Firefox Sync with Add-ons on, enable sync inside Vimium C.
EOF
