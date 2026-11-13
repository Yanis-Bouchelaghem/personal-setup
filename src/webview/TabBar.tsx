import type { Tab } from "../core/messages";
import { CloseIcon } from "./Icons";

/** One pill per restitution. A dot marks a tab that changed while you were elsewhere. */
export function TabBar({
    tabs,
    activeId,
    unread,
    onSelect,
    onClose,
}: {
    tabs: Tab[];
    activeId: string;
    unread: ReadonlySet<string>;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
}) {
    return (
        <div className="tabs glass" role="tablist">
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
                        title="Close (kept in .restitution/archive)"
                        onClick={() => onClose(tab.id)}
                    >
                        <CloseIcon />
                    </button>
                </div>
            ))}
        </div>
    );
}
