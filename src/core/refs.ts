export type Piece = { text: string } | { ref: string };

/**
 * Split a `because` sentence into plain text and references to steps ("1.2"),
 * keeping only references that exist, so version numbers stay plain text.
 */
export function splitRefs(text: string, known: ReadonlySet<string>): Piece[] {
    const pieces: Piece[] = [];
    let rest = "";
    for (const part of text.split(/(\b\d+\.\d+\b)/)) {
        if (known.has(part)) {
            if (rest) {
                pieces.push({ text: rest });
                rest = "";
            }
            pieces.push({ ref: part });
        } else {
            rest += part;
        }
    }
    if (rest) {
        pieces.push({ text: rest });
    }
    return pieces;
}
