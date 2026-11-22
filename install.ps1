<#
.SYNOPSIS
  Sets up this Windows machine from the personal-setup repo.

.DESCRIPTION
  Installs missing tools with winget, copies the Neovim init and the VS Code keybindings, puts the cursor-trail script
  in ~\.vscode-cursor-trail, adds the Custom CSS and JS Loader setting to VS Code's settings.json when it is missing,
  and installs the VS Code extensions (the loader, vscode-neovim, Restitution).

  Safe to run again. Nothing is overwritten without asking: a file that differs is replaced only after a "y" (or with
  -Yes), and the old one is kept next to it as .bak. Use -DryRun to see what would happen without changing anything.

  Windows blocks .ps1 files by default. Allow them once for your user (no admin needed):
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

.EXAMPLE
  .\install.ps1 -DryRun
  .\install.ps1
#>
[CmdletBinding()]
param(
    [switch]$DryRun,          # print what would happen, change nothing
    [switch]$Yes,             # replace files that differ without asking (the old file is kept as .bak)
    [switch]$SkipTools,       # do not install Git, Node, Neovim, VS Code, GitHub CLI or Claude Code
    [switch]$SkipExtensions,  # do not install any VS Code extension (this includes Restitution)
    [switch]$SkipRestitution  # do not build and install the Restitution extension (the slow part)
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$manual = New-Object System.Collections.Generic.List[string]
$loaderKey = 'vscode_custom_css.imports'
$loaderValue = 'file://${userHome}/.vscode-cursor-trail/cursor-trail.js'

function Say([string]$tag, [string]$message) { Write-Host ('{0,-6} {1}' -f $tag, $message) }

function Find-Tool([string]$name, [string[]]$fallbacks = @()) {
    $found = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.Source }
    foreach ($path in $fallbacks) { if (Test-Path $path) { return $path } }
    return $null
}

function Get-BackupPath([string]$path) {
    $backup = "$path.bak"
    if (Test-Path $backup) { $backup = "$path.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss') }
    return $backup
}

# --- tools -----------------------------------------------------------------------------------------------------

$tools = @(
    @{ Name = 'git';      Id = 'Git.Git';                    Fallbacks = @("$env:ProgramFiles\Git\cmd\git.exe") },
    @{ Name = 'node';     Id = 'OpenJS.NodeJS.LTS';          Fallbacks = @("$env:ProgramFiles\nodejs\node.exe") },
    @{ Name = 'nvim';     Id = 'Neovim.Neovim';              Fallbacks = @("$env:ProgramFiles\Neovim\bin\nvim.exe") },
    @{ Name = 'code.cmd'; Id = 'Microsoft.VisualStudioCode'; Fallbacks = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd") },
    @{ Name = 'gh';       Id = 'GitHub.cli';                 Fallbacks = @("$env:ProgramFiles\GitHub CLI\gh.exe") }
)

function Install-Tools {
    $installedSomething = $false
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    foreach ($tool in $tools) {
        if (Find-Tool $tool.Name $tool.Fallbacks) { Say 'ok' "$($tool.Name) is installed"; continue }
        if ($DryRun) { Say 'would' "install $($tool.Id) with winget"; continue }
        if (-not $winget) {
            Say 'warn' "winget not found, cannot install $($tool.Id)"
            $manual.Add("Install $($tool.Id) (winget is missing)")
            continue
        }
        Say 'do' "winget install $($tool.Id)"
        & winget install --id $tool.Id -e --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) {
            Say 'warn' "winget could not install $($tool.Id)"
            $manual.Add("Install $($tool.Id) by hand")
        } else {
            $installedSomething = $true
        }
    }
    if ($installedSomething) {
        # Pick up the PATH entries the installers just added, so the later steps can find node and code.
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    }

    if (Find-Tool 'claude' @("$env:USERPROFILE\.local\bin\claude.exe")) { Say 'ok' 'claude is installed'; return }
    if ($DryRun) { Say 'would' 'npm install -g @anthropic-ai/claude-code'; return }
    $npm = Find-Tool 'npm.cmd' @("$env:ProgramFiles\nodejs\npm.cmd")
    if (-not $npm) {
        Say 'warn' 'npm not found, cannot install Claude Code'
        $manual.Add('Install Claude Code: npm install -g @anthropic-ai/claude-code')
        return
    }
    Say 'do' 'npm install -g @anthropic-ai/claude-code'
    & $npm install -g '@anthropic-ai/claude-code'
    if ($LASTEXITCODE -ne 0) { Say 'warn' 'Claude Code install failed'; $manual.Add('Install Claude Code: npm install -g @anthropic-ai/claude-code') }
}

# --- files -----------------------------------------------------------------------------------------------------

function Install-File([string]$source, [string]$target) {
    if (-not (Test-Path $source)) { throw "missing in the repo: $source" }
    if (Test-Path $target) {
        if ((Get-FileHash $source).Hash -eq (Get-FileHash $target).Hash) { Say 'ok' "$target is up to date"; return }
        if ($DryRun) { Say 'would' "replace $target (the old one is kept as .bak)"; return }
        if (-not $Yes) {
            if (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
                Say 'skip' "$target differs from the repo copy; run again with -Yes to replace it"
                $manual.Add("Replace $target with $source (run install.ps1 -Yes)")
                return
            }
            $answer = Read-Host "$target differs from the repo copy. Replace it (the old one is kept as .bak)? [y/N]"
            if ($answer -notmatch '^(y|yes)$') { Say 'skip' "left $target alone"; return }
        }
        $backup = Get-BackupPath $target
        Copy-Item $target $backup
        Say 'bak' "$target -> $backup"
    } elseif ($DryRun) {
        Say 'would' "create $target"
        return
    }
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item $source $target -Force
    Say 'done' "copied to $target"
}

# VS Code's settings.json is JSON with comments and trailing commas, so only add the one line, right after the
# opening brace, and never touch a value that is already there.
function Set-LoaderSetting {
    $file = Join-Path $env:APPDATA 'Code\User\settings.json'
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $entry = "`"$loaderKey`": [`"$loaderValue`"]"

    if (-not (Test-Path $file) -or [string]::IsNullOrWhiteSpace([System.IO.File]::ReadAllText($file))) {
        if ($DryRun) { Say 'would' "create $file with the Custom CSS and JS Loader setting"; return }
        New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
        [System.IO.File]::WriteAllText($file, "{`n`t$entry`n}`n", $utf8)
        Say 'done' "created $file with the loader setting"
        return
    }

    $text = [System.IO.File]::ReadAllText($file)
    if ($text.Contains("`"$loaderKey`"")) {
        if ($text.Contains($loaderValue)) {
            Say 'ok' 'settings.json already points the loader at the cursor trail'
        } else {
            Say 'warn' "settings.json has $loaderKey with another value; left alone"
            $manual.Add("Set $loaderKey to [`"$loaderValue`"] in settings.json")
        }
        return
    }

    # Match only the brace itself (the lookahead keeps the line ending out), so CRLF files stay CRLF.
    $brace = [regex]::Match($text, '(?m)^[ \t]*\{(?=[ \t]*\r?$)')
    if (-not $brace.Success) {
        Say 'warn' 'could not find the opening brace of settings.json; left alone'
        $manual.Add("Add $entry to settings.json")
        return
    }
    if ($DryRun) { Say 'would' "add $loaderKey to $file (the old file is kept as .bak)"; return }
    $backup = Get-BackupPath $file
    Copy-Item $file $backup
    Say 'bak' "$file -> $backup"
    $newline = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $updated = $text.Insert($brace.Index + $brace.Length, "$newline`t$entry,")
    [System.IO.File]::WriteAllText($file, $updated, $utf8)
    Say 'done' "added $loaderKey to $file"
}

# --- extensions ------------------------------------------------------------------------------------------------

function Install-Extensions {
    $code = Find-Tool 'code.cmd' @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd")
    if (-not $code) {
        Say 'warn' 'code.cmd not found; VS Code extensions skipped'
        $manual.Add('Install VS Code, then run install.ps1 again')
        return
    }
    $installed = @(& $code --list-extensions)
    foreach ($id in 'be5invis.vscode-custom-css', 'asvetliakov.vscode-neovim') {
        if ($installed -contains $id) { Say 'ok' "$id is installed"; continue }
        if ($DryRun) { Say 'would' "code --install-extension $id"; continue }
        Say 'do' "code --install-extension $id"
        & $code --install-extension $id
    }
}

function Install-Restitution {
    $dir = Join-Path $repo 'restitution-extension'
    $npm = Find-Tool 'npm.cmd' @("$env:ProgramFiles\nodejs\npm.cmd")
    $code = Find-Tool 'code.cmd' @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd")
    if (-not $npm -or -not $code) {
        Say 'warn' 'node or VS Code is missing; Restitution skipped'
        $manual.Add('Install Restitution: cd restitution-extension; npm ci; npm run install:local')
        return
    }
    if ($DryRun) { Say 'would' "npm ci and npm run install:local in $dir"; return }
    Push-Location $dir
    try {
        Say 'do' 'npm ci (restitution-extension)'
        & $npm ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
        $env:Path = (Split-Path $code) + ';' + $env:Path   # install:local runs the `code` command
        Say 'do' 'npm run install:local'
        & $npm run install:local
        if ($LASTEXITCODE -ne 0) { throw 'npm run install:local failed' }
    } catch {
        Say 'warn' $_.Exception.Message
        $manual.Add('Install Restitution: cd restitution-extension; npm ci; npm run install:local')
    } finally {
        Pop-Location
    }
}

# --- run -------------------------------------------------------------------------------------------------------

Say 'repo' $repo
if ($DryRun) { Say 'note' 'dry run: nothing will be changed' }

if ($SkipTools) { Say 'skip' 'tools' } else { Install-Tools }

Install-File (Join-Path $repo 'dotfiles\nvim\init.lua') (Join-Path $env:LOCALAPPDATA 'nvim\init.lua')
Install-File (Join-Path $repo 'dotfiles\vscode\keybindings.windows.json') (Join-Path $env:APPDATA 'Code\User\keybindings.json')
Install-File (Join-Path $repo 'dotfiles\vscode\cursor-trail\cursor-trail.js') (Join-Path $env:USERPROFILE '.vscode-cursor-trail\cursor-trail.js')
Set-LoaderSetting

if ($SkipExtensions) {
    Say 'skip' 'VS Code extensions'
} else {
    Install-Extensions
    if ($SkipRestitution) { Say 'skip' 'Restitution' } else { Install-Restitution }
}

Write-Host ''
if ($manual.Count -gt 0) {
    Write-Host 'Needs your attention:'
    foreach ($item in $manual) { Write-Host "  - $item" }
    Write-Host ''
}
Write-Host 'Still to do by hand (a script cannot):'
Write-Host '  - VS Code: sign in to Settings Sync with the PERSONAL GitHub account only, never the work account.'
Write-Host '  - VS Code: Command Palette > "Enable Custom CSS and JS", then restart VS Code (the title bar will say [Unsupported]: harmless).'
Write-Host '  - VS Code: Command Palette > "Restitution: Connect agents".'
Write-Host '  - Run "claude" and "gh auth login" once to sign in.'
Write-Host '  - Firefox: sign in to Firefox Sync with Add-ons on, enable sync inside Vimium C.'
