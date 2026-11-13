import type { Tab } from "../core/messages";
import { CloseIcon, HistoryIcon } from "./Icons";

/**
 * One tab per restitution. A dot marks a tab that changed while you were
 * elsewhere; the clock button at the end brings back a closed one.
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
    return (
        <div className="tabbar">
            <div className="tabs" role="tablist">
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
