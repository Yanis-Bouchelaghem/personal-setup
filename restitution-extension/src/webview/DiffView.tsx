import { type ReactNode, useRef, useState } from "react";

import type { Hunk } from "../core/diff";
import { markTerms } from "../core/terms";
import { Segments } from "./Terms";
import { useKeyCommands } from "./useKeyboard";

const PREVIEW_LINES = 10;
const SIGN = { add: "+", del: "-", ctx: " " } as const;

/** One block of code on a card, with what opening it does. */
export type CodeBlock = {
    key: string;
    /** Undefined when its lines are not in the file. */
    hunk: Hunk | undefined;
    /** A file header above it: a new file starts with this block. */
    head?: ReactNode;
    /** Existing code, not part of the change: no signs. */
    unchanged?: boolean;
    /** Open it in the editor with its lines selected; absent when it can't be. */
    open?: () => void;
    /** Open its diff with its lines selected; absent when there is none. */
    diff?: () => void;
};

/**
 * A card's code: the first lines, with the rest one click away. A block that
 * starts a new file comes under that file's header; the next blocks of the
 * same file are set apart by their line number. Each block opens its own
 * place in the editor when clicked (not when a click ends a text selection).
 */
export function DiffView({
    blocks,
    terms = [],
}: {
    blocks: CodeBlock[];
    /** Names to colour in the code, as the step's words name them. */
    terms?: readonly string[];
}) {
    const [expanded, setExpanded] = useState(false);
    const total = blocks.reduce((sum, block) => sum + size(block), 0);
    const hidden = Math.max(0, total - PREVIEW_LINES);
    const shown = preview(blocks, expanded ? Infinity : PREVIEW_LINES);
    // With several blocks, Enter on the card steps into them.
    const several = shown.filter(({ block }) => block.hunk).length > 1;

    return (
        <div className="diff">
            {shown.map(({ block, lines }, at) => {
                const before = shown[at - 1]?.block;
                return (
                    <div className="block" key={block.key}>
                        {block.head}
                        {!block.head && (several || at > 0) && block.hunk && (
                            <div className="hunk-head">
                                line {block.hunk.newStart}
                                {block.unchanged && !before?.unchanged && (
                                    <span> · unchanged code</span>
                                )}
                            </div>
                        )}
                        {block.hunk ? (
                            <Block
                                block={block}
                                lines={lines}
                                terms={terms}
                                focusable={several}
                            />
                        ) : (
                            <div className="missing">
                                These lines are not in the file.
                            </div>
                        )}
                    </div>
                );
            })}
            {hidden > 0 && (
                <button
                    className="more"
                    type="button"
                    // Enter on the card shows the rest first.
                    data-expand={expanded ? undefined : ""}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded
                        ? "Show less"
                        : `Show ${hidden} more ${hidden === 1 ? "line" : "lines"}`}
                </button>
            )}
        </div>
    );
}

/** A block of code; with the cursor on it, Enter and `gf` open it, `gd` its diff. */
function Block({
    block,
    lines,
    terms,
    focusable,
}: {
    block: CodeBlock;
    lines: Hunk["lines"];
    terms: readonly string[];
    focusable: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useKeyCommands(ref, {
        enter: block.open,
        open: block.open,
        diff: block.diff,
    });
    const classes = [
        "hunk",
        block.open ? "opens" : "",
        block.unchanged ? "unchanged" : "",
    ];
    return (
        <div
            className={classes.filter(Boolean).join(" ")}
            ref={ref}
            title={block.open ? "Open in the editor" : undefined}
            data-block={focusable || undefined}
            tabIndex={focusable ? -1 : undefined}
            onClick={() => {
                if (block.open && !selecting()) {
                    block.open();
                }
            }}
        >
            {lines.map((line, index) => (
                <div className={`ln ln-${line.kind}`} key={index}>
                    <span className="no">{line.newNo ?? line.oldNo}</span>
                    <span className="sign">{SIGN[line.kind]}</span>
                    <span className="txt">
                        <Segments segments={markTerms(line.text, terms)} />
                    </span>
                </div>
            ))}
        </div>
    );
}

/** How many lines a block takes: its lines, or the one saying they are missing. */
function size(block: CodeBlock): number {
    return block.hunk?.lines.length ?? 1;
}

/** The blocks that fit in the first `max` lines, the last one cut short. */
function preview(blocks: CodeBlock[], max: number) {
    const out: { block: CodeBlock; lines: Hunk["lines"] }[] = [];
    let left = max;
    for (const block of blocks) {
        if (left <= 0) {
            break;
        }
        out.push({ block, lines: block.hunk?.lines.slice(0, left) ?? [] });
        left -= size(block);
    }
    return out;
}

/** A click that ends a text selection is for copying, not for opening. */
function selecting(): boolean {
    return (window.getSelection()?.toString() ?? "") !== "";
}
