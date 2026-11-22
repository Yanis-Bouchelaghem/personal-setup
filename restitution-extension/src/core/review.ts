import * as z from "zod";

/**
 * The human's side of a restitution, kept next to the agent's file (never
 * inside it, so an agent rewriting its restitution can't wipe it). Steps are
 * named by fingerprint, which changes whenever the agent changes the step.
 */
const RequestSchema = z.object({
    /** Fingerprint of the step this is about. */
    step: z.string(),
    /** Its label ("3.1") when written, in case the step is gone by now. */
    label: z.string(),
    clarify: z.boolean(),
    comment: z.string().optional(),
    /** When it was copied for the agent; cleared by any edit. */
    sentAt: z.number().optional(),
});

const ReviewSchema = z.object({
    version: z.literal(1),
    /** Steps marked Viewed: folded to their header. */
    viewed: z.array(z.string()).default([]),
    /** Steps the reader has already been shown; anything else is new to them. */
    known: z.array(z.string()).optional(),
    /** Questions, change requests and steps to clarify, for the agent. */
    requests: z.array(RequestSchema).default([]),
    /** The agent's answers the reader has resolved (by answer id): folded. */
    resolved: z.array(z.string()).default([]),
});

export type ReviewRequest = z.infer<typeof RequestSchema>;

export type Review = {
    viewed: string[];
    /** `undefined` until the first look: then everything there counts as known. */
    known?: string[];
    requests: ReviewRequest[];
    resolved: string[];
};

export const EMPTY_REVIEW: Review = { viewed: [], requests: [], resolved: [] };

/** Tolerant: a missing or damaged file is an empty review. */
export function parseReview(text: string): Review {
    try {
        const parsed = ReviewSchema.safeParse(JSON.parse(text));
        if (!parsed.success) {
            return EMPTY_REVIEW;
        }
        const { viewed, known, requests, resolved } = parsed.data;
        return known
            ? { viewed, known, requests, resolved }
            : { viewed, requests, resolved };
    } catch {
        return EMPTY_REVIEW;
    }
}

export function serializeReview(review: Review): string {
    return `${JSON.stringify({ version: 1, ...review }, null, 4)}\n`;
}

/** Everything the panel can change in a review. */
export type ReviewAction =
    /** Viewed folds a step; viewing it also makes it known. */
    | { type: "viewed"; step: string; on: boolean }
    /** Record steps as already shown (the first look at a tab). */
    | { type: "known"; steps: string[] }
    /** Set what is asked about a step; nothing asked removes the request. */
    | {
          type: "request";
          step: string;
          label: string;
          clarify: boolean;
          comment?: string;
      }
    /** The requests were copied for the agent at `at`. */
    | { type: "sent"; at: number }
    /** Resolve an answer (fold it away), or open it again. */
    | { type: "resolve"; answer: string; on: boolean }
    /** Drop every request. */
    | { type: "reset" };

function union(list: string[], more: string[]): string[] {
    return [...new Set([...list, ...more])];
}

function withRequest(
    requests: ReviewRequest[],
    action: Extract<ReviewAction, { type: "request" }>,
): ReviewRequest[] {
    const others = requests.filter((request) => request.step !== action.step);
    const comment = action.comment?.trim() || undefined;
    if (!action.clarify && !comment) {
        return others;
    }
    // An edit is a new request: it has not been sent in this form.
    const request: ReviewRequest = {
        step: action.step,
        label: action.label,
        clarify: action.clarify,
        ...(comment ? { comment } : {}),
    };
    return [...others, request];
}

function withViewed(review: Review, step: string, on: boolean): Review {
    const viewed = review.viewed.filter((existing) => existing !== step);
    if (!on) {
        return { ...review, viewed };
    }
    return {
        ...review,
        viewed: [...viewed, step],
        known: union(review.known ?? [], [step]),
    };
}

export function applyReviewAction(
    review: Review,
    action: ReviewAction,
): Review {
    if (action.type === "viewed") {
        return withViewed(review, action.step, action.on);
    }
    if (action.type === "known") {
        return { ...review, known: union(review.known ?? [], action.steps) };
    }
    if (action.type === "request") {
        return { ...review, requests: withRequest(review.requests, action) };
    }
    if (action.type === "resolve") {
        const resolved = review.resolved.filter((id) => id !== action.answer);
        return {
            ...review,
            resolved: action.on ? [...resolved, action.answer] : resolved,
        };
    }
    if (action.type === "sent") {
        const sentAt = action.at;
        return {
            ...review,
            requests: review.requests.map((request) => ({
                ...request,
                sentAt,
            })),
        };
    }
    return { ...review, requests: [] };
}

/**
 * Requests still open: a request copied for the agent is answered once the
 * restitution has been rewritten after it was sent.
 */
export function pendingRequests(
    review: Review,
    updatedAt: number,
): ReviewRequest[] {
    return review.requests.filter(
        (request) => request.sentAt === undefined || request.sentAt > updatedAt,
    );
}
