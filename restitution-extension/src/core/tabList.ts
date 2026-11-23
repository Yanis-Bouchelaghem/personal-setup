import type { Tab } from "./messages";
import { timeAgo } from "./time";

const HOW =
    "Give an id to restitution_submit, restitution_edit or restitution_answer to work on that tab. Do it only for a tab you were asked about (the user's review names its id): a tab you did not write is another agent's.";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What `restitution_list` tells an agent: every tab in the panel, with its id. */
export function describeTabs(
    tabs: readonly Tab[],
    current: string | undefined,
    now: number,
): string {
    if (tabs.length === 0) {
        return "There are no restitutions in the panel yet.";
    }
    const lines = tabs.map((tab) => {
        const mine = tab.id === current ? "  <- your current tab" : "";
        const age = `updated ${timeAgo(tab.updatedAt, now)}`;
        if (tab.kind === "error") {
            return `- ${tab.id}: unreadable, ${age}${mine}`;
        }
        const goals = tab.restitution.goals;
        const steps = goals.reduce((n, goal) => n + goal.steps.length, 0);
        const details = [
            `${plural(goals.length, "goal")}, ${plural(steps, "step")}`,
            age,
            ...(tab.requests.length > 0
                ? [
                      `${plural(tab.requests.length, "open request")} from the user`,
                  ]
                : []),
        ];
        return `- ${tab.id} "${tab.label}": ${details.join(", ")}${mine}`;
    });
    return [
        `Restitutions in the user's panel (${tabs.length}), newest first:`,
        ...lines,
        "",
        HOW,
    ].join("\n");
}
