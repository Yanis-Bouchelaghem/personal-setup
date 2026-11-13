import { Fragment, useLayoutEffect } from "react";

import type { FileDiff } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Goal } from "../core/restitution";
import { Connector } from "./Connector";
import { ChevronIcon } from "./Icons";
import { StepCard } from "./StepCard";
import { useScrollAnchor } from "./useScrollAnchor";

export function GoalSection({
    goal,
    number,
    fingerprints,
    viewed,
    diffs,
    folded,
    onToggleFold,
    onViewedChange,
    onOpenRequest,
    onClarify,
}: {
    goal: Goal;
    number: number;
    /** One per step: what the Viewed state is keyed by. */
    fingerprints: string[];
    viewed: ReadonlySet<string>;
    diffs: Record<string, FileDiff>;
    folded: boolean;
    onToggleFold: () => void;
    onViewedChange: (fingerprint: string, viewed: boolean) => void;
    onOpenRequest: (request: OpenRequest) => void;
    onClarify: (stepIndex: number) => void;
}) {
    const { box, head, remember } = useScrollAnchor<
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

    const done = fingerprints.filter((fingerprint) =>
        viewed.has(fingerprint),
    ).length;

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
                    aria-expanded={!folded}
                    title={folded ? "Unfold this goal" : "Fold this goal"}
                    onClick={() => {
                        remember();
                        onToggleFold();
                    }}
                >
                    <span className="chev" aria-hidden="true">
                        <ChevronIcon />
                    </span>
                    <span className="goal-no">{number}</span>
                    <span className="goal-title">{goal.title}</span>
                    <span className="goal-progress" title="Steps viewed">
                        {done}/{goal.steps.length}
                    </span>
                    {goal.ref && <span className="goal-ref">{goal.ref}</span>}
                </button>
            </h2>
            {!folded && (
                <div className="steps">
                    {goal.steps.map((step, index) => {
                        const fingerprint = fingerprints[index] ?? "";
                        return (
                            <Fragment key={`${index}-${step.why}`}>
                                {index > 0 && (
                                    <Connector link={step.link ?? "then"} />
                                )}
                                <StepCard
                                    step={step}
                                    label={`${number}.${index + 1}`}
                                    diffs={diffs}
                                    viewed={viewed.has(fingerprint)}
                                    onViewedChange={(on) =>
                                        onViewedChange(fingerprint, on)
                                    }
                                    onOpenRequest={onOpenRequest}
                                    onClarify={() => onClarify(index)}
                                />
                            </Fragment>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
