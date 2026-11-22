import { useRef } from "react";

import type { Tab } from "../core/messages";
import { ChevronIcon, CloseIcon, HistoryIcon } from "./Icons";
import { useTabStrip } from "./useTabStrip";

/**
 * One tab per restitution. A dot marks a tab that changed while you were
 * elsewhere; the clock button at the end brings back a closed one. When
 * the tabs do not fit, arrows on both sides page through them.
 */
export function TabBar({
    tabs,
    activeId,
    unread,
    closed,
    onSelect,
    onClose,
    onReopen,
}: {
    tabs: Tab[];
    activeId: string;
    unread: ReadonlySet<string>;
    closed: number;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onReopen: () => void;
}) {
    const strip = useRef<HTMLDivElement>(null);
    const scroll = useTabStrip(strip, tabs.length, activeId);

    return (
        <div className="tabbar">
            {scroll.overflow && (
                <ScrollArrow
                    direction={-1}
                    disabled={scroll.atStart}
                    onClick={() => scroll.page(-1)}
                />
            )}
            <div
                className={[
                    "tabs",
                    scroll.atStart ? "" : "more-left",
                    scroll.atEnd ? "" : "more-right",
                ]
                    .filter(Boolean)
                    .join(" ")}
                role="tablist"
                ref={strip}
            >
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={`tab${tab.id === activeId ? " active" : ""}`}
                    >
                        <button
                            className="tab-label"
                            type="button"
                            role="tab"
                            aria-selected={tab.id === activeId}
                            title={tab.label}
                            onClick={() => onSelect(tab.id)}
                        >
                            {unread.has(tab.id) && (
                                <span className="dot" title="Updated" />
                            )}
                            <span className="tab-text">{tab.label}</span>
                        </button>
                        <button
                            className="tab-close"
                            type="button"
                            aria-label={`Close ${tab.label}`}
                            title="Close (the clock button brings it back)"
                            onClick={() => onClose(tab.id)}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                ))}
            </div>
            {scroll.overflow && (
                <ScrollArrow
                    direction={1}
                    disabled={scroll.atEnd}
                    onClick={() => scroll.page(1)}
                />
            )}
            {closed > 0 && (
                <button
                    className="icon-btn tabbar-action"
                    type="button"
                    aria-label="Reopen a closed tab"
                    title={`Reopen a closed tab (${closed})`}
                    onClick={onReopen}
                >
                    <HistoryIcon />
                </button>
            )}
        </div>
    );
}

/** Pages the tab strip; greyed out, not removed, at its end so nothing moves. */
function ScrollArrow({
    direction,
    disabled,
    onClick,
}: {
    direction: -1 | 1;
    disabled: boolean;
    onClick: () => void;
}) {
    const label =
        direction < 0
            ? "Show the tabs to the left"
            : "Show the tabs to the right";
    return (
        <button
            className={`icon-btn tab-scroll ${direction < 0 ? "left" : "right"}`}
            type="button"
            aria-label={label}
            title={label}
            aria-disabled={disabled}
            onClick={disabled ? undefined : onClick}
        >
            <ChevronIcon />
        </button>
    );
}
