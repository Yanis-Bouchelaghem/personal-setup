import type { Link } from "../core/restitution";

/**
 * One word on the rail between two cards. With the next card's text it reads
 * as a sentence: "Then" / "write the unit tests to cover what was added."
 */
export function Connector({ link }: { link: Link }) {
    const word = link.charAt(0).toUpperCase() + link.slice(1);
    return (
        <p className="connector" data-link={link}>
            {word}
        </p>
    );
}
