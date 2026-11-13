import { useEffect, useState } from "react";

import type { Tab } from "../core/messages";
import {
    applyReviewAction,
    EMPTY_REVIEW,
    type Review,
    type ReviewAction,
} from "../core/review";
import type { Host } from "./host";

/**
 * The reader's review of a tab: Viewed, the steps already shown, and what they
 * ask the agent. Changes apply at once, with the same function the extension
 * uses to save them, and the saved state that comes back agrees.
 */
export function useReview(tab: Tab, host: Host) {
    const saved: Review =
        tab.kind === "ok"
            ? { viewed: tab.viewed, known: tab.known, requests: tab.requests }
            : EMPTY_REVIEW;
    const [review, setReview] = useState<Review>(saved);
    const savedKey = JSON.stringify(saved);
    useEffect(() => setReview(saved), [savedKey]);

    const act = (action: ReviewAction) => {
        setReview((previous) => applyReviewAction(previous, action));
        host.send({ type: "review", tabId: tab.id, action });
    };

    /** Copy the review for the agent; the extension marks it sent. */
    const copy = (text: string) => {
        setReview((previous) =>
            applyReviewAction(previous, { type: "sent", at: Date.now() }),
        );
        host.send({ type: "copyFeedback", tabId: tab.id, text });
    };

    return { review, act, copy };
}
