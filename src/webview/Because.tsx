import { splitRefs } from "../core/refs";
import { BecauseIcon } from "./Icons";

/**
 * The link between two steps, sitting on the rail between their cards: why
 * this one follows. References to other steps ("1.2") are buttons.
 */
export function Because({
    text,
    labels,
    onGoto,
}: {
    text: string;
    labels: ReadonlySet<string>;
    onGoto: (label: string) => void;
}) {
    return (
        <p className="because">
            <BecauseIcon />
            <span>
                {splitRefs(text, labels).map((piece, index) =>
                    "ref" in piece ? (
                        <button
                            className="ref"
                            type="button"
                            key={index}
                            title={`Go to step ${piece.ref}`}
                            onClick={() => onGoto(piece.ref)}
                        >
                            {piece.ref}
                        </button>
                    ) : (
                        <span key={index}>{piece.text}</span>
                    ),
                )}
            </span>
        </p>
    );
}
