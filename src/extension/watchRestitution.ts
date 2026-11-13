import * as vscode from "vscode";

import { findGitRoot } from "../node/gitRoot";
import {
    ensureRestitutionDir,
    readViewState,
    restitutionDir,
} from "../node/store";
import type { PlanViewProvider } from "./planView";

const DEBOUNCE_MS = 80;

/**
 * Keep the panel in sync with `<gitRoot>/.restitution/working.json`.
 * The git root can sit above the workspace folder (a module inside a monorepo).
 */
export function watchRestitution(
    view: PlanViewProvider,
    log: vscode.LogOutputChannel,
): vscode.Disposable {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const root = folder && findGitRoot(folder.uri.fsPath);
    if (!root) {
        log.info(
            `No git repository for ${folder?.uri.fsPath ?? "(no folder)"}`,
        );
        view.setState({ status: "no-repo" });
        return new vscode.Disposable(() => undefined);
    }
    log.info(`Watching ${restitutionDir(root)}`);

    const disposables: vscode.Disposable[] = [];
    let timer: NodeJS.Timeout | undefined;
    const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            readViewState(root).then(
                (state) => {
                    log.info(`State: ${state.status}`);
                    view.setState(state);
                },
                (error: unknown) => {
                    log.error(String(error));
                    view.setState({ status: "error", errors: [String(error)] });
                },
            );
        }, DEBOUNCE_MS);
    };

    const start = () => {
        const pattern = new vscode.RelativePattern(
            vscode.Uri.file(restitutionDir(root)),
            "working.json",
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        disposables.push(
            watcher,
            watcher.onDidCreate(refresh),
            watcher.onDidChange(refresh),
            watcher.onDidDelete(refresh),
        );
        refresh();
    };
    ensureRestitutionDir(root).then(start, (error: unknown) => {
        log.error(`Could not prepare .restitution/: ${String(error)}`);
        view.setState({ status: "error", errors: [String(error)] });
    });

    return new vscode.Disposable(() => {
        clearTimeout(timer);
        disposables.forEach((d) => d.dispose());
    });
}
