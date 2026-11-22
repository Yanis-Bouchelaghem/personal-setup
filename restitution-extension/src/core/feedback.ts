import type { ReviewRequest } from "./review";

/** "3.1" before "3.10" before "10.1". */
function byLabel(a: ReviewRequest, b: ReviewRequest): number {
    const [ag = 0, as = 0] = a.label.split(".").map(Number);
    const [bg = 0, bs = 0] = b.label.split(".").map(Number);
    return ag - bg || as - bs;
}

function describe(request: ReviewRequest): string {
    const parts = [
        ...(request.clarify ? ["clarify"] : []),
        ...(request.comment ? [`"${request.comment}"`] : []),
    ];
    return `- ${request.label}: ${parts.join(". ")}`;
}

/**
 * What the feedback bar copies for the user to paste to their agent. It only
 * says what the user asks; how to handle it is in the restitution_feedback
 * tool, which the agent calls with the id.
 */
export function feedbackPrompt(
    tabId: string,
    label: string,
    requests: ReviewRequest[],
): string {
    return [
        `My review of the restitution "${label}" (id: ${tabId}):`,
        ...requests.toSorted(byLabel).map(describe),
    ].join("\n");
}
