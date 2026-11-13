import { clarifyPrompt } from "../core/clarify";
import type { FileDiff } from "../core/diff";
import { goalFingerprints } from "../core/fingerprint";
import type { Tab } from "../core/messages";
import { ErrorList } from "./ErrorList";
import { GoalSection } from "./GoalSection";
import type { Host } from "./host";
import { Notice } from "./Notice";
import { Overview } from "./Overview";
import { useGoalFolding } from "./useGoalFolding";
import { useViewed } from "./useViewed";

/** One restitution: the request, an overview of its goals, and the goals. */
export function TabContent({
    tab,
    diffs,
    host,
}: {
    tab: Tab;
    diffs: Record<string, FileDiff>;
    host: Host;
}) {
    const { viewed, change: changeViewed } = useViewed(tab, host);
    const folding = useGoalFolding();

    if (tab.kind === "error") {
        return (
            <Notice title="This restitution can't be shown" tone="error">
                <ErrorList errors={tab.errors} />
            </Notice>
        );
    }
    const { restitution } = tab;
    const fingerprints = goalFingerprints(restitution, diffs);
    const done = fingerprints.map(
        (prints) => prints.filter((print) => viewed.has(print)).length,
    );

    return (
        <>
            {restitution.request && (
                <p className="request">{restitution.request}</p>
            )}
            {restitution.goals.length > 1 && (
                <Overview
                    goals={restitution.goals}
                    done={done}
                    onGoto={folding.reveal}
                />
            )}
            {restitution.goals.map((goal, index) => (
                <GoalSection
                    key={`${index}-${goal.title}`}
                    goal={goal}
                    number={index + 1}
                    fingerprints={fingerprints[index] ?? []}
                    viewed={viewed}
                    diffs={diffs}
                    folded={folding.folded.has(index)}
                    onToggleFold={() => folding.toggle(index)}
                    onViewedChange={changeViewed}
                    onOpenRequest={(request) => host.send(request)}
                    onClarify={(stepIndex) => {
                        const step = goal.steps[stepIndex];
                        if (step) {
                            host.send({
                                type: "copyPrompt",
                                text: clarifyPrompt({
                                    tabId: tab.id,
                                    label: tab.label,
                                    stepLabel: `${index + 1}.${stepIndex + 1}`,
                                    step,
                                }),
                            });
                        }
                    }}
                />
            ))}
        </>
    );
}
