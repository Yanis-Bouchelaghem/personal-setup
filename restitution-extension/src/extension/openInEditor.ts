import { basename, join } from "node:path";

import * as vscode from "vscode";

import type { LineRange } from "../core/diff";
import type { OpenDiff, OpenRequest } from "../core/messages";
import { isRepoRelative } from "../node/git";

type GitApi = { toGitUri(uri: vscode.Uri, ref: string): vscode.Uri };

async function gitApi(): Promise<GitApi | undefined> {
    const extension = vscode.extensions.getExtension<{
        getAPI(version: 1): GitApi;
    }>("vscode.git");
    return (await extension?.activate())?.getAPI(1);
}

/** Whole lines, from the start of the first to the start of the one after. */
function wholeLines(ranges: readonly LineRange[]): vscode.Selection[] {
    return ranges.map(([from, to]) => new vscode.Selection(from - 1, 0, to, 0));
}

/** Select exactly the step's lines (one selection per range) and show them. */
function select(editor: vscode.TextEditor, ranges: readonly LineRange[]): void {
    const selections = wholeLines(ranges);
    const [first] = selections;
    if (!first) {
        return;
    }
    editor.selections = selections;
    editor.revealRange(
        first,
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
}

/** Open a card's change in the editor: as a diff, or as the file itself. */
export async function openInEditor(
    root: string,
    request: OpenRequest,
): Promise<void> {
    if (!isRepoRelative(request.file)) {
        return;
    }
    const uri = vscode.Uri.file(join(root, request.file));

    if (request.type === "openFile") {
        const editor = await vscode.window.showTextDocument(uri, {
            preview: true,
        });
        select(editor, request.ranges);
    } else {
        await openDiff(uri, request);
    }
}

async function openDiff(uri: vscode.Uri, request: OpenDiff): Promise<void> {
    const api = await gitApi();
    if (!api) {
        const editor = await vscode.window.showTextDocument(uri, {
            preview: true,
        });
        select(editor, request.ranges);
        return;
    }
    const head = api.toGitUri(uri, "HEAD");
    await vscode.commands.executeCommand(
        "vscode.diff",
        head,
        uri,
        `${basename(request.file)} (HEAD ↔ working tree)`,
        { selection: wholeLines(request.ranges)[0], preview: true },
    );
    // The diff opens on the first range; select all of them on the file side.
    const modified = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.toString() === uri.toString(),
    );
    if (modified) {
        select(modified, request.ranges);
    }
}
