import { useState } from "react";

import type { StepExample } from "../core/restitution";
import { Collapse } from "./Collapse";
import { ChevronIcon } from "./Icons";

/**
 * Concrete data from outside the codebase (an API payload, CLI output),
 * folded to its title until the reader opens it.
 */
export function Example({ example }: { example: StepExample }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={open ? "example open" : "example"}>
            <button
                className="example-head"
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <span className="chev" aria-hidden="true">
                    <ChevronIcon />
                </span>
                <span className="example-title">{example.title}</span>
            </button>
            <Collapse open={open}>
                <pre className="example-body">{example.body}</pre>
            </Collapse>
        </div>
    );
}
