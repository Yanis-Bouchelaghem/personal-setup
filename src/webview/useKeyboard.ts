import { type RefObject, useEffect, useRef } from "react";

import { type KeyCommand, keyName, keyReader } from "./keys";
import { followElement, scrollToElement, scrollToTop } from "./scrollTo";

/**
 * Keyboard navigation. The places you move between (goal headers, cards)
 * carry `data-nav` ("goal" or "card") and take real focus, so the cursor is
 * the focus ring and Tab still reaches the buttons inside. Moving is done
 * here; what a key does to the focused place is up to that place, which
 * hears it through `useKeyCommands`.
 */
const KEY_EVENT = "restitution-key";

type Handlers = Partial<Record<KeyCommand, () => void>>;

/** What the focused place handles itself; the rest is moving or the page's. */
const PLACE_COMMANDS: ReadonlySet<string> = new Set<KeyCommand>([
    "open",
    "diff",
    "toggle",
    "fold",
    "unfold",
    "clarify",
    "comment",
    "resolve",
]);

const MODIFIERS = new Set(["Shift", "Control", "Meta", "Alt"]);

function isCommand(value: unknown): value is KeyCommand {
    return typeof value === "string" && PLACE_COMMANDS.has(value);
}

/** Listen to the keys for the whole panel; `handlers` gets the page's commands. */
export function useKeyboard(handlers: Handlers): void {
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        const read = keyReader();
        // Where the cursor was, so a fold that hides it doesn't lose your place.
        const place = { last: undefined as HTMLElement | undefined };

        const onKey = (event: KeyboardEvent) => {
            if (ignored(event)) {
                return;
            }
            const command = read(keyName(event), event.timeStamp);
            if (command === undefined) {
                return;
            }
            event.preventDefault();
            if (command === "pending") {
                return;
            }
            const target = destination(command, current(place.last));
            if (target) {
                place.last = target;
                target.focus({ preventScroll: true });
                show(command, target);
            } else if (PLACE_COMMANDS.has(command)) {
                current(place.last)?.dispatchEvent(
                    new CustomEvent(KEY_EVENT, { detail: command }),
                );
            } else {
                latest.current[command]?.();
            }
        };
        // Coming back to the panel: show the cursor where you left it.
        const onFocus = () =>
            requestAnimationFrame(() => {
                if (document.activeElement === document.body) {
                    const back = current(place.last) ?? firstInView();
                    back?.focus({ preventScroll: true });
                }
            });
        const onFocusIn = (event: FocusEvent) => {
            const own =
                event.target instanceof Element &&
                event.target.closest<HTMLElement>("[data-nav]");
            if (own) {
                place.last = own;
            }
        };

        window.addEventListener("keydown", onKey);
        window.addEventListener("focus", onFocus);
        document.addEventListener("focusin", onFocusIn);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("focusin", onFocusIn);
        };
    }, []);
}

/** Let a place hear the keys meant for it while it has the cursor. */
export function useKeyCommands(
    ref: RefObject<HTMLElement | null>,
    handlers: Handlers,
): void {
    const latest = useRef(handlers);
    latest.current = handlers;
    useEffect(() => {
        const element = ref.current;
        if (!element) {
            return undefined;
        }
        const onCommand = (event: Event) => {
            if (event instanceof CustomEvent && isCommand(event.detail)) {
                latest.current[event.detail]?.();
            }
        };
        element.addEventListener(KEY_EVENT, onCommand);
        return () => element.removeEventListener(KEY_EVENT, onCommand);
    }, [ref]);
}

/**
 * Keys that are not for us: typing in a box, anything with Cmd or Alt (those
 * are VS Code's: Cmd+arrows leave the panel), and Enter or Space on a button
 * or link, which already do what they say.
 */
function ignored(event: KeyboardEvent): boolean {
    const target = event.target instanceof Element ? event.target : undefined;
    if (
        event.metaKey ||
        event.altKey ||
        MODIFIERS.has(event.key) ||
        target?.closest("textarea, input, [contenteditable]")
    ) {
        return true;
    }
    const clicks = event.key === "Enter" || event.key === " ";
    return clicks && Boolean(target?.closest("button, a, summary"));
}

/** The places you can move to now: not inside a folded goal or card. */
function places(kind?: string): HTMLElement[] {
    const selector = kind ? `[data-nav="${kind}"]` : "[data-nav]";
    return [...document.querySelectorAll<HTMLElement>(selector)].filter(
        (element) =>
            element.closest("[inert]") === null &&
            element.getClientRects().length > 0,
    );
}

/** The place with the cursor, or the last one it was on. */
function current(last: HTMLElement | undefined): HTMLElement | undefined {
    const focused = document.activeElement?.closest<HTMLElement>("[data-nav]");
    return focused ?? (last?.isConnected ? last : undefined);
}

/** Where a moving command takes the cursor; undefined for other commands. */
function destination(
    command: KeyCommand,
    from: HTMLElement | undefined,
): HTMLElement | undefined {
    switch (command) {
        case "next":
            return from ? after(places(), from) : firstInView();
        case "prev":
            return from ? before(places(), from) : firstInView();
        case "nextGoal":
            return from ? after(places("goal"), from) : places("goal")[0];
        case "prevGoal":
            return from ? before(places("goal"), from) : places("goal")[0];
        case "first":
            return places()[0];
        case "last":
            return places().at(-1);
        case "halfDown":
        case "halfUp":
            window.scrollBy(
                0,
                ((command === "halfDown" ? 1 : -1) * window.innerHeight) / 2,
            );
            return firstInView();
        default:
            return undefined;
    }
}

/** The first of `list` after `from` in the page, even if `from` is now hidden. */
function after(
    list: HTMLElement[],
    from: HTMLElement,
): HTMLElement | undefined {
    return list.find(
        (element) =>
            from.compareDocumentPosition(element) &
            Node.DOCUMENT_POSITION_FOLLOWING,
    );
}

function before(
    list: HTMLElement[],
    from: HTMLElement,
): HTMLElement | undefined {
    return list.findLast(
        (element) =>
            from.compareDocumentPosition(element) &
            Node.DOCUMENT_POSITION_PRECEDING,
    );
}

/** How far down the pinned tab bar reaches. */
function pinnedTop(): number {
    return (
        document.querySelector(".tabbar")?.getBoundingClientRect().bottom ?? 0
    );
}

/** Where the window ends for reading: above the feedback bar when it shows. */
function readableBottom(): number {
    const bar = document.querySelector(".feedback-bar.shown");
    return bar ? bar.getBoundingClientRect().top - 8 : window.innerHeight;
}

/**
 * The first place you can see under the pinned headers: a card still partly
 * on screen, or a goal whose start is (not one pinned over its own steps).
 */
function firstInView(): HTMLElement | undefined {
    const top = pinnedTop();
    const list = places();
    const seen = (element: HTMLElement) => {
        const section =
            element.dataset.nav === "goal" && element.closest("section");
        return section
            ? section.getBoundingClientRect().top >= top - 4
            : element.getBoundingClientRect().bottom > top + 24;
    };
    return list.find(seen) ?? list[0];
}

/** Put the cursor somewhere you can see it, after the page changed under it. */
export function focusFirstInView(): void {
    firstInView()?.focus({ preventScroll: true });
}

/**
 * Scroll to where the cursor went: a goal jump lands the goal at the top,
 * like the overview's links; `gg` goes back to the request; paging already
 * put the page where you asked; a step moves only as much as it must.
 */
function show(command: KeyCommand, target: HTMLElement): void {
    if (command === "first") {
        scrollToTop();
    } else if (command === "nextGoal" || command === "prevGoal") {
        scrollToElement(target.closest("section") ?? target);
    } else if (command !== "halfDown" && command !== "halfUp") {
        follow(target);
    }
}

/**
 * Keep the cursor in view. Back up to a goal: show it from its start, not
 * just its pinned header; down to one: just enough to see its header.
 */
function follow(target: HTMLElement): void {
    const section = target.dataset.nav === "goal" && target.closest("section");
    const box =
        section && section.getBoundingClientRect().top < pinnedTop()
            ? section
            : (target.closest("h2") ?? target);
    followElement(box, readableBottom());
}
