/**
 * Terms: the code names an agent wraps in backticks in a goal title or a
 * step's "why". Each gets a colour, the same wherever it shows: in the text
 * and in the code of the cards that name it.
 */

import type { Restitution } from "./restitution";

/** A piece of text: plain, or a term (shown without its backticks). */
export type Segment = { text: string; term?: string };

/** How many colours terms cycle through (theme.css has one per slot). */
export const TERM_COLOURS = 10;

/** The text split into plain pieces and terms; a lone backtick stays as it is. */
export function splitTerms(text: string): Segment[] {
    const out: Segment[] = [];
    let plain = "";
    let at = 0;
    while (at < text.length) {
        const open = text.indexOf("`", at);
        const close = open < 0 ? -1 : text.indexOf("`", open + 1);
        if (close < 0) {
            plain += text.slice(at);
            break;
        }
        plain += text.slice(at, open);
        const inside = text.slice(open + 1, close);
        if (inside.trim() === "") {
            plain += text.slice(open, close + 1);
        } else {
            if (plain) {
                out.push({ text: plain });
            }
            plain = "";
            out.push({ text: inside, term: termKey(inside) });
        }
        at = close + 1;
    }
    if (plain) {
        out.push({ text: plain });
    }
    return out;
}

/** The text without its backticks, for places that only take plain text. */
export function plainText(text: string): string {
    return splitTerms(text)
        .map((segment) => segment.text)
        .join("");
}

/** The terms a text names, in order, each once. */
export function termsOf(text: string): string[] {
    const terms = splitTerms(text).flatMap((s) => (s.term ? [s.term] : []));
    return [...new Set(terms)];
}

/**
 * A colour slot per term, in order of first appearance through the page
 * (each goal's title, then its steps), so two terms read close together
 * never share a colour until the slots run out.
 */
export function termColours(restitution: Restitution): Map<string, number> {
    const slots = new Map<string, number>();
    const add = (text: string) => {
        for (const term of termsOf(text)) {
            if (!slots.has(term)) {
                slots.set(term, slots.size % TERM_COLOURS);
            }
        }
    };
    for (const goal of restitution.goals) {
        add(goal.title);
        for (const step of goal.steps) {
            add(step.why);
        }
    }
    return slots;
}

/**
 * A line of code split around the given terms, each found as a whole name
 * (not inside a longer identifier); where two terms start at the same place,
 * the longer one wins.
 */
export function markTerms(line: string, terms: readonly string[]): Segment[] {
    const sorted = terms
        .filter(Boolean)
        .toSorted((a, b) => b.length - a.length);
    const out: Segment[] = [];
    let plain = "";
    let at = 0;
    while (at < line.length) {
        const term = sorted.find((t) => matchesAt(line, t, at));
        if (term) {
            if (plain) {
                out.push({ text: plain });
            }
            plain = "";
            out.push({ text: term, term });
            at += term.length;
        } else {
            plain += line[at];
            at += 1;
        }
    }
    if (plain) {
        out.push({ text: plain });
    }
    return out;
}

/** The name a term stands for: "save()" is the name save. */
function termKey(text: string): string {
    return text.trim().replace(/\(\)$/, "");
}

const NAME_CHAR = /[\w$]/;

function matchesAt(line: string, term: string, at: number): boolean {
    if (!line.startsWith(term, at)) {
        return false;
    }
    // A term that starts or ends with a name character must not run on into one.
    const before = line[at - 1] ?? "";
    const after = line[at + term.length] ?? "";
    const edgeStart = NAME_CHAR.test(term[0] ?? "");
    const edgeEnd = NAME_CHAR.test(term.at(-1) ?? "");
    return (
        !(edgeStart && NAME_CHAR.test(before)) &&
        !(edgeEnd && NAME_CHAR.test(after))
    );
}
