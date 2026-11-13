import type { FileDiff } from "../core/diff";
import type { OpenDiff } from "../core/messages";
import type { Goal } from "../core/restitution";
import { StepCard } from "./StepCard";

export function GoalSection({
    goal,
    number,
    diffs,
    onOpenDiff,
}: {
    goal: Goal;
    number: number;
    diffs: Record<string, FileDiff>;
    onOpenDiff: (request: OpenDiff) => void;
}) {
    return (
        <section className="goal">
            <h2 className="goal-head glass">
                <span className="goal-no">{number}</span>
                <span className="goal-title">{goal.title}</span>
                {goal.ref && <span className="goal-ref">{goal.ref}</span>}
            </h2>
            <div className="steps">
                {goal.steps.map((step, index) => (
                    <StepCard
                        key={`${index}-${step.why}`}
                        step={step}
                        label={`${number}.${index + 1}`}
                        diffs={diffs}
                        onOpenDiff={onOpenDiff}
                    />
                ))}
            </div>
        </section>
    );
}
