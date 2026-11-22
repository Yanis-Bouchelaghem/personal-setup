import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import type {
    FromWebview,
    OpenRequest,
    ReviewMessage,
    ToWebview,
    ViewState,
} from "../core/messages";
import { isWebUrl } from "../core/restitution";

/** The side-panel webview. It only forwards the current ViewState. */
export class PlanViewProvider implements vscode.WebviewViewProvider {
    static readonly viewType = "restitution.plan";

    private view: vscode.WebviewView | undefined;
    private state: ViewState = { status: "empty", closed: 0 };

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly handlers: {
            onOpen: (request: OpenRequest) => void;
            onCloseTab: (id: string) => void;
            onReopenTab: () => void;
            onReview: (message: ReviewMessage) => void;
            onCopyFeedback: (tabId: string, text: string) => void;
            onInitRepo: () => void;
        },
    ) {}

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
            } else if (message.type === "closeTab") {
                this.handlers.onCloseTab(message.id);
            } else if (message.type === "reopenTab") {
                this.handlers.onReopenTab();
            } else if (message.type === "review") {
                this.handlers.onReview(message);
            } else if (message.type === "copyFeedback") {
                this.handlers.onCopyFeedback(message.tabId, message.text);
            } else if (message.type === "initRepo") {
                this.handlers.onInitRepo();
            } else if (message.type === "focusEditor") {
                void vscode.commands.executeCommand(
                    "workbench.action.focusActiveEditorGroup",
                );
            } else if (message.type === "openUrl") {
                // Only web pages: the address comes from the agent's file.
                if (isWebUrl(message.url)) {
                    void vscode.env.openExternal(vscode.Uri.parse(message.url));
                }
            } else {
                this.handlers.onOpen(message);
            }
        });
        view.onDidDispose(() => {
            this.view = undefined;
        });
    }

    /** Switch the panel to a tab, for instance one that was just reopened. */
    select(id: string): void {
        const message: ToWebview = { type: "select", id };
        void this.view?.webview.postMessage(message);
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
