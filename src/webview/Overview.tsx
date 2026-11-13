import type { Goal } from "../core/restitution";

/** The goals at a glance, with progress; a click jumps to one. */
export function Overview({
    goals,
    done,
    onGoto,
}: {
    goals: Goal[];
    /** Steps viewed, per goal. */
    done: number[];
    onGoto: (goal: number) => void;
}) {
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
