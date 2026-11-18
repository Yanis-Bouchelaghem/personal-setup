import { Collapse } from "./Collapse";

/** One thing the reader hasn't seen since the agent's last update. */
export type UpdateItem = {
    /** The step it is on ("2.1"), to jump there. */
    label: string;
    kind: "answer" | "step";
    /** The answer, or the step's explanation: the row shows its start. */
    text: string;
};

/**
 * The top of a tab after the agent updates it: its note on what it changed
 * and why, then one row per thing you haven't seen (a new answer, a new or
 * changed step). A row jumps to its card; rows go as you see them, and
 * "Seen" clears them all. In git's "modified" colour, like the cards it
 * points at. Gone once there is nothing left to see.
 */
export function Updates({
    note,
    items,
    shown,
    onGoto,
    onSeen,
}: {
    note: string | undefined;
    items: readonly UpdateItem[];
    shown: boolean;
    onGoto: (label: string) => void;
    onSeen: () => void;
}) {
    return (
        <Collapse open={shown}>
            <section className="updates" aria-label="Updates to restitution">
                <header className="updates-head">
                    <h2>Updates to restitution</h2>
                    <button className="text-btn" type="button" onClick={onSeen}>
                        Seen
                    </button>
                </header>
                {note && <p className="updates-note">{note}</p>}
                {items.length > 0 && (
                    <ul className="updates-list">
                        {items.map((item) => (
                            <li key={`${item.kind}-${item.label}-${item.text}`}>
                                <button
                                    className="updates-row"
                                    type="button"
                                    title={item.text}
                                    onClick={() => onGoto(item.label)}
                                >
                                    <span className="updates-label">
                                        {item.label}
                                    </span>
                                    <span className="updates-kind">
                                        {item.kind === "answer"
                                            ? "Answer"
                                            : "Updated"}
                                    </span>
                                    <span className="updates-text">
                                        {item.text}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </Collapse>
    );
}
