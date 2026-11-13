import { type FileDiff, firstChangedLine, hunksForRange } from "../core/diff";
import type { OpenDiff } from "../core/messages";
import type { Step } from "../core/restitution";
import { DiffView } from "./DiffView";

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
    onOpenDiff,
}: {
    step: Step;
    label: string;
    diffs: Record<string, FileDiff>;
    onOpenDiff: (request: OpenDiff) => void;
}) {
    const diff = step.file ? diffs[step.file] : undefined;
    const hunks = hunksForRange(diff, step.lines);
    const file = step.file;

    return (
        <article className="card glass">
            <header className="card-head">
                <span className="step-no">{label}</span>
                {file && <FilePath path={file} />}
                {file && hunks.length > 0 && (
                    <button
                        className="open"
                        type="button"
                        title="Open this change in the editor"
                        onClick={() =>
                            onOpenDiff({
                                type: "openDiff",
                                file,
                                line: firstChangedLine(hunks),
                                status: diff?.status,
                            })
                        }
                    >
                        Open ↗
                    </button>
                )}
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
