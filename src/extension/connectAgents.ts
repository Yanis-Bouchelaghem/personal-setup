import { exec, execFile } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

import { type Agent, connectCommand } from "../node/agents";

const run = promisify(execFile);
const runCmd = promisify(exec);

/**
 * Put the bundled MCP server at a path that survives extension updates:
 * agents keep that path in their config.
 */
export async function installServer(
    context: vscode.ExtensionContext,
): Promise<string> {
    const dir = context.globalStorageUri.fsPath;
    await mkdir(dir, { recursive: true });
    const target = join(dir, "mcp-server.js");
    const source = vscode.Uri.joinPath(
        context.extensionUri,
        "dist",
        "mcp-server.js",
    );
    await copyFile(source.fsPath, target);
    return target;
}

/** Let Copilot's agent mode find the server through VS Code's own MCP support. */
export function registerCopilotServer(serverPath: string): vscode.Disposable {
    return vscode.lm.registerMcpServerDefinitionProvider("restitution.mcp", {
        provideMcpServerDefinitions: () => {
            // The editor's own Node, so it works even without node on the PATH.
            const server = new vscode.McpStdioServerDefinition(
                "Restitution",
                process.execPath,
                [serverPath],
                { ELECTRON_RUN_AS_NODE: "1" },
                "0.0.1",
            );
            server.cwd = vscode.workspace.workspaceFolders?.[0]?.uri;
            return [server];
        },
    });
}

type Choice = vscode.QuickPickItem & { agent: Agent };

const CHOICES: Choice[] = [
    { label: "Claude Code", description: "all projects", agent: "claude-user" },
    {
        label: "Claude Code",
        description: "this workspace only",
        agent: "claude-project",
    },
    { label: "Codex", description: "all projects", agent: "codex" },
];

/**
 * On macOS and Linux, a login shell, so `claude` and `codex` are on the PATH
 * even when VS Code was opened from the Dock. On Windows, cmd.exe, which
 * already has the user's PATH.
 */
function runInShell(command: string, cwd: string): Promise<unknown> {
    if (process.platform === "win32") {
        return runCmd(command, { cwd });
    }
    const shell = process.env.SHELL ?? "/bin/zsh";
    return run(shell, ["-ilc", command], { cwd });
}

export async function connectAgents(
    serverPath: string,
    cwd: string,
    log: vscode.LogOutputChannel,
): Promise<void> {
    const picked = await vscode.window.showQuickPick(CHOICES, {
        canPickMany: true,
        title: "Connect agents to Restitution",
        placeHolder: "Where should agents find the Restitution tools?",
    });
    if (!picked || picked.length === 0) {
        return;
    }
    const connected: string[] = [];
    for (const choice of picked) {
        const command = connectCommand(choice.agent, serverPath);
        try {
            await runInShell(command, cwd);
            connected.push(`${choice.label} (${choice.description})`);
        } catch (error) {
            log.error(`${choice.label}: ${String(error)}`);
            const copy = "Copy command";
            const answer = await vscode.window.showErrorMessage(
                `Could not connect ${choice.label} (${choice.description}). Run the command yourself?`,
                copy,
            );
            if (answer === copy) {
                await vscode.env.clipboard.writeText(command);
            }
        }
    }
    if (connected.length > 0) {
        void vscode.window.showInformationMessage(
            `Connected: ${connected.join(", ")}. Restart running agent sessions to pick it up. Copilot finds it on its own under MCP servers.`,
        );
    }
}
