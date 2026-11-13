import * as vscode from "vscode";

import { PlanViewProvider } from "./planView";
import { watchRestitution } from "./watchRestitution";

export function activate(context: vscode.ExtensionContext): void {
    const log = vscode.window.createOutputChannel("Restitution", { log: true });
    const plan = new PlanViewProvider(context.extensionUri);
    context.subscriptions.push(
        log,
        vscode.window.registerWebviewViewProvider(
            PlanViewProvider.viewType,
            plan,
            {
                webviewOptions: { retainContextWhenHidden: true },
            },
        ),
        watchRestitution(plan, log),
    );
    log.info("Activated");
}

export function deactivate(): void {}
