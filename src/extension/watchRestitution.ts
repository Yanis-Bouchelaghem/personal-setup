import * as vscode from "vscode";

import {
    ensureRestitutionDir,
    readViewState,
    restitutionDir,
} from "../node/store";
import type { PlanViewProvider } from "./planView";

const DEBOUNCE_MS = 80;

/**
 * Keep the panel in sync with `<gitRoot>/.restitution/working.json` and with
 * the working tree, since the hunks shown come from `git diff`.
 */
export function watchRestitution(
    root: string,
    view: PlanViewProvider,
    log: vscode.LogOutputChannel,
): vscode.Disposable {
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
            // Hunks change when code is saved, or edited elsewhere (an agent's
            // shell commands) and we come back to the window.
            vscode.workspace.onDidSaveTextDocument(refresh),
            vscode.window.onDidChangeWindowState((window) => {
                if (window.focused) {
                    refresh();
                }
            }),
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
