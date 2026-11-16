import { Fragment, useLayoutEffect, useRef } from "react";

import type { FileDiff } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Goal } from "../core/restitution";
import type { ReviewRequest } from "../core/review";
import type { SourceLines } from "../core/source";
import { Collapse } from "./Collapse";
import { Connector } from "./Connector";
import { ChevronIcon } from "./Icons";
import { StepCard } from "./StepCard";
import { UpdatedTag } from "./UpdatedTag";
import { useKeyCommands } from "./useKeyboard";
import { useScrollAnchor } from "./useScrollAnchor";

/** Where a step stands for the reader. */
export type StepState = {
    fingerprint: string;
    viewed: boolean;
    updated: boolean;
    /** Its code changed after it was explained. */
    stale: boolean;
    request: ReviewRequest | undefined;
};

export function GoalSection({
    goal,
    number,
    steps,
    diffs,
    sources,
    folded,
    onToggleFold,
    onViewedChange,
    onSeen,
    onRequestChange,
    onOpenRequest,
    onOpenUrl,
}: {
    goal: Goal;
    number: number;
    /** One per step, in order. */
    steps: StepState[];
    diffs: Record<string, FileDiff>;
    sources: Record<string, SourceLines>;
    folded: boolean;
    onToggleFold: () => void;
    onViewedChange: (fingerprint: string, viewed: boolean) => void;
    onSeen: (fingerprint: string) => void;
    onRequestChange: (
        fingerprint: string,
        label: string,
        clarify: boolean,
        comment: string | undefined,
    ) => void;
    onOpenRequest: (request: OpenRequest) => void;
    onOpenUrl: (url: string) => void;
}) {
    const { box, head, remember, snap } = useScrollAnchor<
        HTMLElement,
        HTMLHeadingElement
    >(folded);

    // The step headers pin just under this one, so they need its real height.
    useLayoutEffect(() => {
        const element = head.current;
        const target = box.current;
        if (!element || !target) {
            return undefined;
        }
        const sync = () =>
            target.style.setProperty(
                "--goalhead-h",
                `${element.offsetHeight}px`,
            );
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(element);
        return () => observer.disconnect();
    }, [box, head]);

    const toggle = useRef<HTMLButtonElement>(null);
    const toggleFold = () => {
        remember();
        onToggleFold();
    };
    useKeyCommands(toggle, {
        toggle: toggleFold,
        fold: folded ? undefined : toggleFold,
        unfold: folded ? toggleFold : undefined,
    });

    const done = steps.filter((state) => state.viewed).length;
    const updated = steps.some((state) => state.updated);

    return (
        <section
            className={`goal${folded ? " folded" : ""}`}
            data-goal={number}
            ref={box}
        >
            <h2 className="goal-head glass" ref={head}>
                <button
                    className="goal-toggle"
                    type="button"
                    data-nav="goal"
                    ref={toggle}
                    aria-expanded={!folded}
                    title={
                        folded ? "Unfold this goal · zo" : "Fold this goal · zc"
                    }
                    onClick={toggleFold}
                >
                    <span className="chev" aria-hidden="true">
                        <ChevronIcon />
                    </span>
                    <span className="goal-no">{number}</span>
                    <span className="goal-title" title={goal.title}>
                        {goal.title}
                    </span>
                    <UpdatedTag shown={updated} />
                    <span className="goal-progress" title="Steps viewed">
                        {done}/{goal.steps.length}
                    </span>
                    {goal.ref && <span className="goal-ref">{goal.ref}</span>}
                </button>
            </h2>
            <Collapse open={!folded} snap={snap}>
                <div className="steps">
                    {goal.steps.map((step, index) => {
                        const state = steps[index];
                        const label = `${number}.${index + 1}`;
                        const fingerprint = state?.fingerprint ?? "";
                        return (
                            <Fragment key={`${index}-${step.why}`}>
                                {index > 0 && (
                                    <Connector link={step.link ?? "then"} />
                                )}
                                <StepCard
                                    step={step}
                                    label={label}
                                    diffs={diffs}
                                    sources={sources}
                                    viewed={state?.viewed ?? false}
                                    updated={state?.updated ?? false}
                                    stale={state?.stale ?? false}
                                    request={state?.request}
                                    onViewedChange={(on) => {
                                        // The last step viewed folds the goal: keep its header where it is.
                                        const others = steps.every(
                                            (other, at) =>
                                                at === index || other.viewed,
                                        );
                                        if (on && others) {
                                            remember();
                                            // The cursor was in the goal: it stays on its header.
                                            if (
                                                box.current?.contains(
                                                    document.activeElement,
                                                )
                                            ) {
                                                toggle.current?.focus({
                                                    preventScroll: true,
                                                });
                                            }
                                        }
                                        onViewedChange(fingerprint, on);
                                    }}
                                    onSeen={() => onSeen(fingerprint)}
                                    onRequestChange={(clarify, comment) =>
                                        onRequestChange(
                                            fingerprint,
                                            label,
                                            clarify,
                                            comment,
                                        )
                                    }
                                    onOpenRequest={onOpenRequest}
                                    onOpenUrl={onOpenUrl}
                                />
                            </Fragment>
                        );
                    })}
                </div>
            </Collapse>
        </section>
    );
}
