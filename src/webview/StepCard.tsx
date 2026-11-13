import type { Step } from "../core/restitution";

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

export function StepCard({ step, label }: { step: Step; label: string }) {
    return (
        <article className="card glass">
            <header className="card-head">
                <span className="step-no">{label}</span>
                {step.file && <FilePath path={step.file} />}
            </header>
            <p className="why">{step.why}</p>
            {step.because && <p className="because">{step.because}</p>}
        </article>
    );
}
