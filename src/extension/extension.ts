import { homedir } from "node:os";

import * as vscode from "vscode";

import { findGitRoot } from "../node/gitRoot";
import {
    connectAgents,
    installServer,
    registerCopilotServer,
} from "./connectAgents";
import { openInEditor } from "./openInEditor";
import { PlanViewProvider } from "./planView";
import { watchRestitution } from "./watchRestitution";

export function activate(context: vscode.ExtensionContext): void {
    const log = vscode.window.createOutputChannel("Restitution", { log: true });
    const folder = vscode.workspace.workspaceFolders?.[0];
    // The git root can sit above the workspace folder (a module in a monorepo).
    const root = folder && findGitRoot(folder.uri.fsPath);

    const plan = new PlanViewProvider(context.extensionUri, (request) => {
        if (root) {
            openInEditor(root, request).catch((error: unknown) =>
                log.error(`Could not open in editor: ${String(error)}`),
            );
        }
    });
    context.subscriptions.push(
        log,
        vscode.window.registerWebviewViewProvider(
            PlanViewProvider.viewType,
            plan,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );

    // The MCP server lives at a stable path so agent configs survive updates.
    const serverPath = installServer(context);
    serverPath.then(
        (path) => context.subscriptions.push(registerCopilotServer(path)),
        (error: unknown) =>
            log.error(`Could not install the MCP server: ${String(error)}`),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("restitution.connectAgents", async () =>
            connectAgents(
                await serverPath,
                folder?.uri.fsPath ?? homedir(),
                log,
            ),
        ),
    );

    if (root) {
        context.subscriptions.push(watchRestitution(root, plan, log));
    } else {
        log.info(
            `No git repository for ${folder?.uri.fsPath ?? "(no folder)"}`,
        );
        plan.setState({ status: "no-repo" });
    }
    log.info("Activated");
}

export function deactivate(): void {}
