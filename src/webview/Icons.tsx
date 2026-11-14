import type { ReactNode } from "react";

/** Small outline icons: they take the colour of the text around them. */
function Icon({ children }: { children: ReactNode }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

/** Two panes, minus on the left, plus on the right. */
export function DiffIcon() {
    return (
        <Icon>
            <rect x="2" y="2.5" width="12" height="11" rx="2" />
            <path d="M8 2.5v11M4.2 8h2M10 8h2M11 7v2" />
        </Icon>
    );
}

/** A page with a folded corner and a line marker. */
export function FileIcon() {
    return (
        <Icon>
            <path d="M4 2h5l3 3v8.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-11A.5.5 0 0 1 4 2z" />
            <path d="M9 2v3h3M6 8.5h4M6 11h2.5" />
        </Icon>
    );
}

/**
 * A small icon button. `text` is a one-word label shown beside the icon when
 * there is room (the CSS decides); `pressed` makes it a toggle that shows
 * when it is on.
 */
export function IconButton({
    label,
    text,
    onClick,
    pressed,
    absent,
    unavailable,
    children,
}: {
    label: string;
    text?: string;
    onClick: () => void;
    pressed?: boolean;
    /** Not available here: invisible, but it keeps its place. */
    absent?: boolean;
    /** Why it cannot be used here: greyed out, with this as its tooltip. */
    unavailable?: string;
    children: ReactNode;
}) {
    const tooltip = unavailable ?? label;
    return (
        <button
            className={absent ? "icon-btn absent" : "icon-btn"}
            aria-hidden={absent}
            disabled={absent}
            // aria-disabled rather than disabled, so the tooltip still shows.
            aria-disabled={unavailable !== undefined}
            type="button"
            title={tooltip}
            aria-label={tooltip}
            aria-pressed={pressed}
            onClick={unavailable === undefined ? onClick : undefined}
        >
            {children}
            {text && <span className="btn-text">{text}</span>}
        </button>
    );
}

export function CloseIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
    );
}

/** A clock with a counter-clockwise arrow: bring something back. */
export function HistoryIcon() {
    return (
        <Icon>
            <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5v3h3M8 5v3.2l2 1.3" />
        </Icon>
    );
}

export function ChevronIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 6l4 4 4-4" />
        </svg>
    );
}

/** One line splitting into three: break a step into smaller ones. */
export function ClarifyIcon() {
    return (
        <Icon>
            <path d="M2.5 8h3.5M6 8c2 0 2-4 4-4h3.5M6 8h7.5M6 8c2 0 2 4 4 4h3.5" />
        </Icon>
    );
}

/** A speech bubble: say something about this step. */
export function CommentIcon() {
    return (
        <Icon>
            <path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8l-3 2.5v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
        </Icon>
    );
}
