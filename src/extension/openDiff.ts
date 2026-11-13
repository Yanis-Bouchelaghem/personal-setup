import { basename, join } from "node:path";

import * as vscode from "vscode";

import type { OpenDiff } from "../core/messages";
import { isRepoRelative } from "../node/git";

type GitApi = { toGitUri(uri: vscode.Uri, ref: string): vscode.Uri };

async function gitApi(): Promise<GitApi | undefined> {
    const extension = vscode.extensions.getExtension<{
        getAPI(version: 1): GitApi;
    }>("vscode.git");
    return (await extension?.activate())?.getAPI(1);
}

/** Open a file's working-tree diff (or the file itself) at the first change. */
export async function openDiff(root: string, request: OpenDiff): Promise<void> {
    if (!isRepoRelative(request.file)) {
        return;
    }
    const uri = vscode.Uri.file(join(root, request.file));
    const line = request.line ? request.line - 1 : undefined;
    const selection =
        line === undefined ? undefined : new vscode.Range(line, 0, line, 0);

    const api = request.status === "added" ? undefined : await gitApi();
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
