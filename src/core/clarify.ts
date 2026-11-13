import type { LineRange } from "./diff";
import type { Step } from "./restitution";

/** "2-19, 21-43" */
function describeLines(lines: readonly LineRange[]): string {
    return lines
        .map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`))
        .join(", ");
}

/**
 * The prompt the Clarify button copies, for the user to paste to their agent.
 * It stands on its own: an agent that never saw the restitution, or the guide,
 * can still find the step, know what is wanted and update the right tab.
 */
export function clarifyPrompt({
    tabId,
    label,
    stepLabel,
    step,
}: {
    tabId: string;
    label: string;
    stepLabel: string;
    step: Step;
}): string {
    const where =
        step.file && step.lines
            ? `${step.file}, lines ${describeLines(step.lines)}`
            : "no code";
    return [
        `Clarify step ${stepLabel} of the restitution "${label}" (.restitution/${tabId}.json).`,
        "",
        `The step (${where}) says: "${step.why}"`,
        "",
        "I need it at a finer grain. Read that file, then replace this one step with several smaller steps, one per change, each showing only its own lines and continuing the sentence after a connector word. Keep the other steps as they are.",
        `Then call restitution_submit with the whole restitution and "id": "${tabId}", so the same tab is updated. If you have not read restitution_guide yet, read it first (see "Clarifying a step").`,
    ].join("\n");
}
