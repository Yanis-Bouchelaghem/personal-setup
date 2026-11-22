import type { StepDoc } from "../core/restitution";
import { DocIcon } from "./Icons";

/**
 * Where to read more: the exact places in the documentation that back what
 * a step relies on. Each one opens in the browser.
 */
export function DocLinks({
    docs,
    onOpen,
}: {
    docs: readonly StepDoc[];
    onOpen: (url: string) => void;
}) {
    return (
        <ul className="docs">
            {docs.map((doc) => (
                <li key={doc.url}>
                    <button
                        className="doc-link"
                        type="button"
                        title={`${doc.url} · gx`}
                        onClick={() => onOpen(doc.url)}
                    >
                        <DocIcon />
                        <span>{doc.title}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}
