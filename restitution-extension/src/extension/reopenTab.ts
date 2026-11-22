import * as vscode from "vscode";

import { timeAgo } from "../core/time";
import { readClosedTabs, restoreTab } from "../node/store/archive";
import type { PlanViewProvider } from "./planView";

/** Pick a closed restitution and bring it back, selected. */
export async function reopenTab(
    root: string,
    plan: PlanViewProvider,
): Promise<void> {
    const closed = await readClosedTabs(root);
    if (closed.length === 0) {
        void vscode.window.showInformationMessage(
            "No closed restitutions to reopen.",
        );
        return;
    }
    const now = Date.now();
    const picked = await vscode.window.showQuickPick(
        closed.map((tab) => ({
            label: tab.label,
            description: `closed ${timeAgo(tab.closedAt, now)}`,
            id: tab.id,
        })),
        {
            title: "Reopen a closed restitution",
            placeHolder: "Pick one to bring back",
        },
    );
    if (picked) {
        plan.select(await restoreTab(root, picked.id));
    }
}
