import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import type { FromWebview, ToWebview, ViewState } from "../core/messages";

/** The side-panel webview. It only forwards the current ViewState. */
export class PlanViewProvider implements vscode.WebviewViewProvider {
    static readonly viewType = "restitution.plan";

    private view: vscode.WebviewView | undefined;
    private state: ViewState = { status: "empty" };

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        const assets = vscode.Uri.joinPath(
            this.extensionUri,
            "dist",
            "webview",
        );
        view.webview.options = {
            enableScripts: true,
            localResourceRoots: [assets],
        };
        view.webview.html = renderHtml(view.webview, assets);
        view.webview.onDidReceiveMessage((message: FromWebview) => {
            if (message.type === "ready") {
                this.post();
            }
        });
        view.onDidDispose(() => {
            this.view = undefined;
        });
    }

    setState(state: ViewState): void {
        this.state = state;
        this.post();
    }

    private post(): void {
        const message: ToWebview = { type: "state", state: this.state };
        void this.view?.webview.postMessage(message);
    }
}

function renderHtml(webview: vscode.Webview, assets: vscode.Uri): string {
    const nonce = randomBytes(16).toString("base64");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(assets, "main.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(assets, "main.css"));
    const csp = [
        "default-src 'none'",
        `style-src ${webview.cspSource}`,
        `script-src 'nonce-${nonce}'`,
    ].join("; ");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style.toString()}">
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
}
