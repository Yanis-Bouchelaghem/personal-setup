import type { ReactNode } from "react";

/**
 * Content that opens and closes with a short height animation instead of
 * snapping. It stays rendered while closed (inert, so nothing in it can be
 * focused). `snap` skips the animation, for when the page has to be scrolled
 * at the same moment to keep a pinned header in place.
 */
export function Collapse({
    open,
    snap = false,
    children,
}: {
    open: boolean;
    snap?: boolean;
    children: ReactNode;
}) {
    const classes = ["collapse", open ? "open" : "", snap ? "snap" : ""];
    return (
        <div className={classes.filter(Boolean).join(" ")} inert={!open}>
            <div className="collapse-inner">{children}</div>
        </div>
    );
}
