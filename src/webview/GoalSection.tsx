import { useLayoutEffect, useRef } from "react";

import type { FileDiff } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Goal } from "../core/restitution";
import { StepCard } from "./StepCard";

export function GoalSection({
    goal,
    number,
    fingerprints,
    viewed,
    diffs,
    onViewedChange,
    onOpenRequest,
}: {
    goal: Goal;
    number: number;
    /** One per step: what the Viewed state is keyed by. */
    fingerprints: string[];
    viewed: ReadonlySet<string>;
    diffs: Record<string, FileDiff>;
    onViewedChange: (fingerprint: string, viewed: boolean) => void;
    onOpenRequest: (request: OpenRequest) => void;
}) {
    const section = useRef<HTMLElement>(null);
    const head = useRef<HTMLHeadingElement>(null);

    // The step headers pin just under this one, so they need its real height.
    useLayoutEffect(() => {
        const element = head.current;
        if (!element || !section.current) {
            return undefined;
        }
        const target = section.current;
        const sync = () =>
            target.style.setProperty(
                "--goalhead-h",
                `${element.offsetHeight}px`,
            );
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const done = fingerprints.filter((fingerprint) =>
        viewed.has(fingerprint),
    ).length;

    return (
        <section className="goal" ref={section}>
            <h2 className="goal-head glass" ref={head}>
                <span className="goal-no">{number}</span>
                <span className="goal-title">{goal.title}</span>
                <span className="goal-progress" title="Steps viewed">
                    {done}/{goal.steps.length}
                </span>
                {goal.ref && <span className="goal-ref">{goal.ref}</span>}
            </h2>
            <div className="steps">
                {goal.steps.map((step, index) => {
                    const fingerprint = fingerprints[index] ?? "";
                    return (
                        <StepCard
                            key={`${index}-${step.why}`}
                            step={step}
                            label={`${number}.${index + 1}`}
                            diffs={diffs}
                            viewed={viewed.has(fingerprint)}
                            onViewedChange={(on) =>
                                onViewedChange(fingerprint, on)
                            }
                            onOpenRequest={onOpenRequest}
                        />
                    );
                })}
            </div>
        </section>
    );
}
