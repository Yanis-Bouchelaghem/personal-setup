import { basename, join } from "node:path";

import * as vscode from "vscode";

import type { OpenDiff, OpenRequest } from "../core/messages";
import { isRepoRelative } from "../node/git";

type GitApi = { toGitUri(uri: vscode.Uri, ref: string): vscode.Uri };

async function gitApi(): Promise<GitApi | undefined> {
    const extension = vscode.extensions.getExtension<{
        getAPI(version: 1): GitApi;
    }>("vscode.git");
    return (await extension?.activate())?.getAPI(1);
}

/** Open a card's change in the editor: as a diff, or as the file at its line. */
export async function openInEditor(
    root: string,
    request: OpenRequest,
): Promise<void> {
    if (!isRepoRelative(request.file)) {
        return;
    }
    const uri = vscode.Uri.file(join(root, request.file));
    const line = request.line ? request.line - 1 : undefined;
    const selection =
        line === undefined ? undefined : new vscode.Range(line, 0, line, 0);

    // An added file has no previous version to compare with.
    const asFile = request.type === "openFile" || request.status === "added";
    if (asFile) {
        await vscode.window.showTextDocument(uri, { selection, preview: true });
    } else {
        await openDiff(uri, request, selection);
    }
}

async function openDiff(
    uri: vscode.Uri,
    request: OpenDiff,
    selection: vscode.Range | undefined,
): Promise<void> {
    const api = await gitApi();
    if (!api) {
        await vscode.window.showTextDocument(uri, { selection, preview: true });
        return;
    }
    const head = api.toGitUri(uri, "HEAD");
    if (request.status === "deleted") {
        await vscode.window.showTextDocument(head, { preview: true });
        return;
    }
    await vscode.commands.executeCommand(
        "vscode.diff",
        head,
        uri,
        `${basename(request.file)} (HEAD ↔ working tree)`,
        { selection, preview: true },
    );
}
