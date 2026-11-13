import type { Goal } from "../core/restitution";
import type { StepState } from "./GoalSection";
import { UpdatedTag } from "./UpdatedTag";

/** The goals at a glance, with progress and what changed; a click jumps to one. */
export function Overview({
    goals,
    states,
    onGoto,
}: {
    goals: Goal[];
    /** Where every step stands, goal by goal. */
    states: StepState[][];
    onGoto: (goal: number) => void;
}) {
    const done = states.map((goal) => goal.filter((s) => s.viewed).length);
    const total = goals.reduce((sum, goal) => sum + goal.steps.length, 0);
    const viewed = done.reduce((sum, count) => sum + count, 0);
    return (
        <nav className="overview glass" aria-label="Goals">
            <p className="overview-title">
                <span>Goals</span>
                <span className="overview-count">
                    {viewed}/{total} steps viewed
                </span>
            </p>
            <div className="overview-bar" aria-hidden="true">
                <span
                    style={{ width: `${total ? (viewed / total) * 100 : 0}%` }}
                />
            </div>
            <ul>
                {goals.map((goal, index) => {
                    const finished = done[index] === goal.steps.length;
                    const updated = states[index]?.some((s) => s.updated);
                    return (
                        <li key={`${index}-${goal.title}`}>
                            <button
                                className={`overview-row${finished ? " finished" : ""}`}
                                type="button"
                                onClick={() => onGoto(index)}
                            >
                                <span className="goal-no">{index + 1}</span>
                                <span className="overview-goal">
                                    {goal.title}
                                </span>
                                <UpdatedTag shown={updated ?? false} />
                                <span className="goal-progress">
                                    {done[index]}/{goal.steps.length}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
