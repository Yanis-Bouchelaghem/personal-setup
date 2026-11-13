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

export function IconButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            className="icon-btn"
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
        >
            {children}
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
