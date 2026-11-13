import { type FileDiff, firstChangedLine, hunksForRange } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import { DiffView } from "./DiffView";
import { ChevronIcon, DiffIcon, FileIcon, IconButton } from "./Icons";
import { useScrollAnchor } from "./useScrollAnchor";

/** Folder part fades and truncates first; the file name always stays visible. */
function FilePath({ path }: { path: string }) {
    const split = path.lastIndexOf("/") + 1;
    return (
        <code className="chip" title={path}>
            <span className="dir">{path.slice(0, split)}</span>
            <span className="name">{path.slice(split)}</span>
        </code>
    );
}

export function StepCard({
    step,
    label,
    diffs,
    viewed,
    onViewedChange,
    onOpenRequest,
}: {
    step: Step;
    label: string;
    diffs: Record<string, FileDiff>;
    viewed: boolean;
    onViewedChange: (viewed: boolean) => void;
    onOpenRequest: (request: OpenRequest) => void;
}) {
    const file = step.file;
    const diff = file ? diffs[file] : undefined;
    const hunks = hunksForRange(diff, step.lines);
    const line = firstChangedLine(hunks);
    const status = diff?.status;
    // Nothing to compare for a new file; nothing to open for a deleted one.
    const canDiff =
        file !== undefined && hunks.length > 0 && status !== "added";
    const canOpenFile =
        file !== undefined && hunks.length > 0 && status !== "deleted";

    // Viewed is the only state: a viewed step is folded to its header.
    const open = !viewed;
    const { box, head, remember } = useScrollAnchor<HTMLElement, HTMLElement>(
        viewed,
    );
    const toggleViewed = () => {
        remember();
        onViewedChange(!viewed);
    };

    return (
        <article
            className={`card glass${open ? "" : " collapsed viewed-card"}`}
            data-step={label}
            ref={box}
        >
            {/* The whole header toggles Viewed; its own controls keep their jobs. */}
            <header
                className="card-head"
                ref={head}
                onClick={(event) => {
                    const own =
                        event.target instanceof Element &&
                        event.target.closest("button, label, a");
                    if (!own) {
                        toggleViewed();
                    }
                }}
            >
                <span className="chev" aria-hidden="true">
                    <ChevronIcon />
                </span>
                <span className="step-no">{label}</span>
                {file && <FilePath path={file} />}
                <span className="actions">
                    {open && canDiff && (
                        <IconButton
                            label="Open the diff in the editor"
                            onClick={() =>
                                onOpenRequest({
                                    type: "openDiff",
                                    file,
                                    line,
                                    status,
                                })
                            }
                        >
                            <DiffIcon />
                        </IconButton>
                    )}
                    {open && canOpenFile && (
                        <IconButton
                            label={`Open the file${line ? ` at line ${line}` : ""}`}
                            onClick={() =>
                                onOpenRequest({ type: "openFile", file, line })
                            }
                        >
                            <FileIcon />
                        </IconButton>
                    )}
                </span>
                <label className="viewed">
                    <input
                        type="checkbox"
                        checked={viewed}
                        onChange={toggleViewed}
                    />
                    <span>Viewed</span>
                </label>
            </header>
            {open && (
                <>
                    <p className="why">{step.why}</p>
                    {hunks.length > 0 && <DiffView hunks={hunks} />}
                    {file && hunks.length === 0 && (
                        <p className="no-diff">
                            No uncommitted changes in this file
                            {step.lines ? " range" : ""}.
                        </p>
                    )}
                </>
            )}
        </article>
    );
}
