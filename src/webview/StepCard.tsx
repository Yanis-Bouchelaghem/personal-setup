import { type FileDiff, firstChangedLine, hunksForRange } from "../core/diff";
import type { OpenRequest } from "../core/messages";
import type { Step } from "../core/restitution";
import { DiffView } from "./DiffView";
import { DiffIcon, FileIcon, IconButton } from "./Icons";

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
    onOpenRequest,
}: {
    step: Step;
    label: string;
    diffs: Record<string, FileDiff>;
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

    return (
        <article className="card glass">
            <header className="card-head">
                <span className="step-no">{label}</span>
                {file && <FilePath path={file} />}
                <span className="actions">
                    {canDiff && (
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
                    {canOpenFile && (
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
            </header>
            <p className="why">{step.why}</p>
            {step.because && <p className="because">{step.because}</p>}
            {hunks.length > 0 && <DiffView hunks={hunks} />}
            {file && hunks.length === 0 && (
                <p className="no-diff">
                    No uncommitted changes in this file
                    {step.lines ? " range" : ""}.
                </p>
            )}
        </article>
    );
}
