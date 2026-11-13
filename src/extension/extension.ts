import * as vscode from "vscode";

import { findGitRoot } from "../node/gitRoot";
import { openDiff } from "./openDiff";
import { PlanViewProvider } from "./planView";
import { watchRestitution } from "./watchRestitution";

export function activate(context: vscode.ExtensionContext): void {
    const log = vscode.window.createOutputChannel("Restitution", { log: true });
    const folder = vscode.workspace.workspaceFolders?.[0];
    // The git root can sit above the workspace folder (a module in a monorepo).
    const root = folder && findGitRoot(folder.uri.fsPath);

    const plan = new PlanViewProvider(context.extensionUri, (request) => {
        if (root) {
            openDiff(root, request).catch((error: unknown) =>
                log.error(`Could not open diff: ${String(error)}`),
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
