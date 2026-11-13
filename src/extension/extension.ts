import * as vscode from "vscode";

import { PlanViewProvider } from "./planView";
import { watchRestitution } from "./watchRestitution";

export function activate(context: vscode.ExtensionContext): void {
    const plan = new PlanViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PlanViewProvider.viewType,
            plan,
            {
                webviewOptions: { retainContextWhenHidden: true },
            },
        ),
        watchRestitution(plan),
    );
}

export function deactivate(): void {}
