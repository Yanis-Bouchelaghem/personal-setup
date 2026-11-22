# Cursor trail for VS Code

A trail behind the cursor in VS Code, like the Neovim one in the stream it was copied from: a bright wedge with a
pointy tail, a soft glow on the head, and an ease-out catch-up of about 260 ms. It follows whatever has focus (editor
caret, Explorer and other list rows, the integrated terminal, input boxes), so moving from the code to a sidebar also
leaves a trail.

It is **one injected script** (`cursor-trail.js`, version 0.2.0), not an extension: VS Code has no API for drawing
smooth overlays, so the script is loaded into the workbench by the **Custom CSS and JS Loader**
(`be5invis.vscode-custom-css`, tested with 7.5.1). This folder is the source of truth.

## Install on a machine

The repo's installer (`install.ps1` on Windows, `install.sh` on macOS) does steps 1 and 2 for you; the steps below are what
it does, for when it cannot run.

Written for Claude. Steps 4 and 5 need the user: you cannot run VS Code's Command Palette or restart it.

1. **Loader extension.** `code --install-extension be5invis.vscode-custom-css`. Settings Sync usually installs it already.
2. **Copy the script to a fixed path under the home folder; the clone can then live anywhere.** The setting below holds
   one value that must be right on Windows and macOS, so it goes through `${userHome}`. The loader reads the file only
   when "Reload Custom CSS and JS" runs and pastes its contents into VS Code, so a copy is enough. Run from the root of
   the clone:
   - Windows (PowerShell):
     ```powershell
     New-Item -ItemType Directory -Force "$env:USERPROFILE\.vscode-cursor-trail" | Out-Null
     Copy-Item dotfiles\vscode\cursor-trail\cursor-trail.js "$env:USERPROFILE\.vscode-cursor-trail\" -Force
     ```
   - macOS:
     ```sh
     mkdir -p ~/.vscode-cursor-trail && cp dotfiles/vscode/cursor-trail/cursor-trail.js ~/.vscode-cursor-trail/
     ```

   Repeat this copy whenever `cursor-trail.js` changes in the repo (after a `git pull`, say), then do step 4 again.

   Then edit the user `settings.json` (back it up as `settings.json.bak` first, and ask before changing it: Settings Sync
   is on, so this value reaches the other machine, which is what you want here):
   ```jsonc
   "vscode_custom_css.imports": [
     "file://${userHome}/.vscode-cursor-trail/cursor-trail.js"
   ],
   ```
   The loader expands `${userHome}` to `C:\Users\<name>` on Windows (tested: it resolves there) and to `/Users/<name>` on
   macOS (untested). It also knows `${env:NAME[:default]}`, `${workspaceFolder}`, `${cwd}`, `${execPath}` and
   `${pathSeparator}`, but do not use `${env:...}` on macOS: VS Code started from the Dock does not see shell exports.
   A Settings Sync merge once wiped this key on the Windows PC (2026-11-22) because the other side did not have it; with
   the same value on both sides that cannot happen. Check the key is still there after a merge.
3. **Alternative without a copy:** point the setting straight at the script in the clone with an absolute URL
   (`file:///C:/dev/personal-setup/dotfiles/vscode/cursor-trail/cursor-trail.js` on Windows: forward slashes, three
   slashes) and keep the key out of Settings Sync, so it does not overwrite the other machine's value. Do not load the
   script from a web URL such as the repo's raw GitHub link: it would run unreviewed code inside VS Code on every reload.
   ```jsonc
   "settingsSync.ignoredSettings": ["vscode_custom_css.imports"]
   ```
4. **User:** Command Palette, "Enable Custom CSS and JS" (first time) or "Reload Custom CSS and JS", then quit and
   restart VS Code completely.
5. **Check it took.** In VS Code: Help > Toggle Developer Tools > Console, run `cursorTrail.version`. It should print
   `'0.3.0'`. Without the UI, check that the patched `workbench.html` now contains the script (Windows):
   ```powershell
   Get-ChildItem "$env:LOCALAPPDATA\Programs\Microsoft VS Code" -Recurse -Filter workbench.html | Select-String -Pattern cursorTrail -List
   ```
   On macOS, search for `workbench.html` under `/Applications/Visual Studio Code.app/Contents/Resources/app/out/vs/code/`
   and grep it for `cursorTrail`. A file match is not proof that it renders: ask the user to move the cursor and confirm.

The loader must be able to write VS Code's own files. A per-user Windows install is writable. On macOS the install folder
usually needs its ownership changed first; use the exact command from the loader's README. The macOS steps are untested.

## Things that will surprise the user

- The title bar shows **`[Unsupported]`** and VS Code may say the installation is corrupt. That is VS Code noticing the
  patched `workbench.html`. It is harmless; "Don't show again" hides the notice.
- **A VS Code update removes the patch.** Run "Reload Custom CSS and JS" and restart again.
- The loader **copies the script into VS Code**. After any edit to `cursor-trail.js`, run "Reload Custom CSS and JS" and
  restart, or the old version keeps running.
- Do not run another cursor animation at the same time: keep `editor.cursorSmoothCaretAnimation` off and do not use
  the "VSCode Animations" extension's cursor trail, or two trails draw.
- On a company-managed machine, patching VS Code may need IT's agreement. Ask first.

## Tuning

No file edit needed. In the DevTools console (Help > Toggle Developer Tools), then reload the window:

```js
localStorage.setItem('cursorTrail.config', JSON.stringify({ color: '#ff6b6b', duration: 200 }))
```

The options and defaults are at the top of `cursor-trail.js`. `color: 'auto'` brightens the theme's caret colour; the
Dark+ caret is grey, so the default trail is near-white until `color` is set. Runtime switches: `cursorTrail.disable()`,
`cursorTrail.enable()`, `cursorTrail.destroy()`. The settings are stored per machine and never synced.

To remove it: delete the import, run "Disable Custom CSS and JS", restart.

## What it follows

| Focus is in...            | Trail head lands on...                                   |
| ------------------------- | -------------------------------------------------------- |
| text editor               | the caret cell (`.cursors-layer > .cursor`)              |
| explorer / search / lists | the focused row's label, plus a soft wash across the row |
| integrated terminal       | the terminal cursor cell (xterm helper textarea)         |
| input boxes               | the left edge of the field                               |
| a webview (any extension) | the pane's top-left corner, then a comet round its border |

Moves shorter than `minDistance` (16 px) never trail, so typing and a single `h` or `l` stay quiet. Moves less than
`chainMs` (140 ms) apart count as one path: holding an arrow key grows the trail along the path the cursor took (up to
150 px) and the ease-out only starts once the cursor stops. A single jump catches up immediately.

## Known gaps

- Developed and used on Windows 11 with VS Code 1.147. Not tried on macOS yet.
- It relies on VS Code's DOM class names (`.monaco-editor .cursors-layer > .cursor`, `.native-edit-context`,
  `.monaco-list`, `.xterm-helper-textarea`), confirmed on 1.147. If a VS Code update renames them the trail goes quiet:
  fix `resolveTarget()`.
- Terminal tracking assumes xterm parks its helper textarea on the cursor cell; not verified.
- Multi-cursor: only the primary caret is followed.
- A webview's content is a separate document, so the trail cannot follow the cursor inside it; it only shows that focus
  arrived in the pane: the trail lands on its top-left corner, a faint wash covers it and a comet runs once round its
  border. Turn it all off with `followPanes: false`, the comet with `paneWave: false`, the wash with `paneWash: false`.
  It works for every extension because it only looks at the iframe's box.

## Tests and reference

`test/harness.html` is a mock page using the real VS Code class names. `test/measure.js` replays a reference jump and
compares tail length, brightness along the streak, glow falloff and colour with numbers measured from the stream, within
about 10%. It does not run inside VS Code. Serve this folder and open it:

```powershell
python -m http.server 5178 --directory dotfiles/vscode/cursor-trail
# then open http://localhost:5178/test/harness.html and call runMeasure(), runHold(), runKinds() in the console
```

The look comes from frames 1138 to 1141 s of https://youtu.be/0Wl6RI3vb2s?t=1138 (1080p, 30 fps): cells about
9.8 x 19.5 px, caret rgb(230,59,62), streak core about rgb(255,101,99), the wedge's alpha full for the first ~34% from the
head then fading to 0 at the tip, tail catching up with a quad ease-out over about 260 ms. The exact tool in the stream
was never identified, so this is a reproduction from measurements, not a port.
