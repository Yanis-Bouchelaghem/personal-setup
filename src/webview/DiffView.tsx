import { useState } from "react";

import { countLines, type Hunk, takeLines } from "../core/diff";

const PREVIEW_LINES = 10;
const SIGN = { add: "+", del: "-", ctx: " " } as const;

/**
 * A step's hunks: the first lines, with the rest one click away. Unchanged
 * code (existing code a step explains) says so above it, so it is never
 * mistaken for part of the change.
 */
export function DiffView({
    hunks,
    unchanged = false,
}: {
    hunks: Hunk[];
    unchanged?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const total = countLines(hunks);
    const hidden = Math.max(0, total - PREVIEW_LINES);
    const shown = expanded ? hunks : takeLines(hunks, PREVIEW_LINES);

    return (
        <div className={unchanged ? "diff unchanged" : "diff"}>
            {unchanged && <div className="diff-label">Unchanged code</div>}
            {shown.map((hunk) => (
                <div className="hunk" key={`${hunk.oldStart}-${hunk.newStart}`}>
                    {shown.length > 1 && (
                        <div className="hunk-head">line {hunk.newStart}</div>
                    )}
                    {hunk.lines.map((line, index) => (
                        <div className={`ln ln-${line.kind}`} key={index}>
                            <span className="no">
                                {line.newNo ?? line.oldNo}
                            </span>
                            <span className="sign">{SIGN[line.kind]}</span>
                            <span className="txt">{line.text}</span>
                        </div>
                    ))}
                </div>
            ))}
            {hidden > 0 && (
                <button
                    className="more"
                    type="button"
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
