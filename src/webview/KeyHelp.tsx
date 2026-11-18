import { KEYMAP } from "./keys";

/**
 * The panel's keys, from `?`. A light card over the bottom of the panel, not
 * a dialog: it takes no focus, so the keys keep working while it shows.
 */
export function KeyHelp({ shown }: { shown: boolean }) {
    return (
        <aside
            className={shown ? "key-help glass shown" : "key-help glass"}
            aria-label="Keyboard shortcuts"
            aria-hidden={!shown}
            inert={!shown}
        >
            {KEYMAP.map((section) => (
                <section key={section.title}>
                    <h3>{section.title}</h3>
                    <dl>
                        {section.rows.map((row) => (
                            <div className="key-row" key={row.command}>
                                <dt>
                                    {row.keys.map((key) => (
                                        <kbd key={key}>{capLabel(key)}</kbd>
                                    ))}
                                </dt>
                                <dd>{row.does}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
            <p className="key-help-foot">
                A count repeats a move (3j) · Cmd+arrows move between the panel
                and the editor · ? or Esc to close
            </p>
        </aside>
    );
}

const CAPS: Readonly<Record<string, string>> = {
    Escape: "Esc",
    ArrowDown: "↓",
    ArrowUp: "↑",
    ArrowLeft: "←",
    ArrowRight: "→",
};

/** How a key reads on its cap. */
function capLabel(key: string): string {
    return CAPS[key] ?? key.replace("ctrl+", "Ctrl+");
}
