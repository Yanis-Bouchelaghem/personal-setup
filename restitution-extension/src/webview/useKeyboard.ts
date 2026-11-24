import { type RefObject, useEffect, useRef } from "react";

import { type KeyCommand, keyName, keyReader } from "./keys";
import {
    followElement,
    marginTop,
    scrollAhead,
    scrollLines,
    scrollToElement,
    scrollToTop,
} from "./scrollTo";

/**
 * Keyboard navigation. The places you move between (goal headers, cards)
 * carry `data-nav` ("goal" or "card") and take real focus, so the cursor is
 * the focus ring and Tab still reaches the buttons inside. Moving is done
 * here; what a key does to the focused place is up to that place, which
 * hears it through `useKeyCommands`.
 */
const KEY_EVENT = "restitution-key";

/** What a key does; a place's handler also gets the count typed before it. */
type Handlers = Partial<Record<KeyCommand, (count: number) => void>>;

/** What a place hears: the command, and the count (`2gx`: the second link). */
type Heard = { command: KeyCommand; count: number };

/** What the focused place handles itself; the rest is moving or the page's. */
const PLACE_COMMANDS: ReadonlySet<string> = new Set<KeyCommand>([
    "enter",
    "open",
    "diff",
    "toggle",
    "examples",
    "docs",
    "fold",
    "unfold",
    "clarify",
    "comment",
    "resolve",
]);

const MODIFIERS = new Set(["Shift", "Control", "Meta", "Alt"]);

/** Moves a count repeats (`3j`); the rest happen once. */
const REPEATED: ReadonlySet<KeyCommand> = new Set<KeyCommand>([
    "next",
    "prev",
    "nextGoal",
    "prevGoal",
    "halfDown",
    "halfUp",
    "nextChange",
    "prevChange",
]);

/** How far `j` scrolls through a long card: about three lines. */
const LINE_STEP = 56;

function isHeard(value: unknown): value is Heard {
    return (
        typeof value === "object" &&
        value !== null &&
        "command" in value &&
        "count" in value &&
        typeof value.command === "string" &&
        PLACE_COMMANDS.has(value.command) &&
        typeof value.count === "number"
    );
}

/** Listen to the keys for the whole panel; `handlers` gets the page's commands. */
export function useKeyboard(handlers: Handlers): void {
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        const reader = keyReader();
        // Where the cursor was, so a fold that hides it doesn't lose your place.
        // `block` is which block of that card it was on, if any.
        const place = {
            last: undefined as HTMLElement | undefined,
            block: undefined as number | undefined,
        };

        const run = (command: KeyCommand, count: number) => {
            const from = current(place.last);
            if (
                moveInBlocks(command) ||
                enterBlocks(command, from) ||
                moveWithin(command, from) ||
                moveInTree(command, from)
            ) {
                return;
            }
            if (command === "nextChange" || command === "prevChange") {
                jumpToChange(command === "nextChange" ? 1 : -1);
                return;
            }
            const target = destination(command, from);
            if (target) {
                place.last = target;
                target.focus({ preventScroll: true });
                show(command, target);
            } else if (PLACE_COMMANDS.has(command) && from) {
                tell(from, command, count);
            } else {
                latest.current[command]?.(count);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (ignored(event)) {
                return;
            }
            const read = reader(keyName(event), event.timeStamp);
            if (read === undefined) {
                return;
            }
            event.preventDefault();
            if (read === "pending") {
                return;
            }
            // A move repeats; anything else gets the count to use as it likes.
            if (REPEATED.has(read.command)) {
                for (let n = 0; n < read.count; n++) {
                    run(read.command, 1);
                }
            } else {
                run(read.command, read.count);
            }
        };
        // Coming back to the panel: show the cursor where you left it.
        const onFocus = () =>
            requestAnimationFrame(() => {
                if (document.activeElement === document.body) {
                    const kept = current(place.last);
                    const back = kept ?? firstInView();
                    // Found again by position: opening a block may redraw it.
                    const block =
                        kept && place.block !== undefined
                            ? blocksOf(kept)[place.block]
                            : undefined;
                    (block ?? back)?.focus({ preventScroll: true });
                }
            });
        const onFocusIn = (event: FocusEvent) => {
            const target =
                event.target instanceof Element ? event.target : undefined;
            const own = target?.closest<HTMLElement>("[data-nav]");
            if (own) {
                place.last = own;
                const block = target?.closest<HTMLElement>("[data-block]");
                place.block = block ? blocksOf(own).indexOf(block) : undefined;
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

/**
 * Escape, for a panel with nothing to move through (no restitution, no git
 * repository, an error): it still gives the keyboard back to the editor.
 */
export function useLeaveOnEscape(leave: () => void): void {
    const latest = useRef(leave);
    latest.current = leave;
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !ignored(event)) {
                event.preventDefault();
                latest.current();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}

/**
 * Move the cursor to the next (1) or previous (-1) card with something new on
 * it, wrapping around; one in a folded goal unfolds it first.
 */
export function jumpToChange(direction: 1 | -1): void {
    const list = [
        ...document.querySelectorAll<HTMLElement>(".card.updated[data-nav]"),
    ];
    const from = document.activeElement?.closest<HTMLElement>("[data-nav]");
    const target =
        direction === 1
            ? ((from && after(list, from)) ?? list[0])
            : ((from && before(list, from)) ?? list.at(-1));
    if (target) {
        jumpTo(target);
    }
}

/** Put the cursor on a card and bring it into view, unfolding its goal first. */
export function jumpTo(target: HTMLElement): void {
    const go = () => {
        target.focus({ preventScroll: true });
        follow(target);
    };
    const toggle = target
        .closest(".goal.folded")
        ?.querySelector<HTMLElement>('[data-nav="goal"]');
    if (toggle) {
        toggle.click();
        requestAnimationFrame(() => requestAnimationFrame(go));
    } else {
        go();
    }
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
            if (event instanceof CustomEvent && isHeard(event.detail)) {
                latest.current[event.detail.command]?.(event.detail.count);
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

/**
 * `j` and `k` on a card the screen can't hold: move through it a few lines at
 * a time, like the cursor in a long block, before leaving it. A card scrolled
 * out of sight comes back first, like vim returning to its cursor. True when
 * that was the move.
 */
function moveWithin(
    command: KeyCommand,
    from: HTMLElement | undefined,
): boolean {
    if (!from || (command !== "next" && command !== "prev")) {
        return false;
    }
    // Measured where the page is heading, so held keys add up smoothly.
    const ahead = scrollAhead();
    const box = from.getBoundingClientRect();
    const rect = { top: box.top - ahead, bottom: box.bottom - ahead };
    const bottom = readableBottom();
    if (rect.bottom < pinnedTop() || rect.top > bottom) {
        follow(from);
        return true;
    }
    if (from.dataset.nav !== "card") {
        return false;
    }
    const hidden =
        command === "next" ? rect.bottom - bottom : marginTop(from) - rect.top;
    if (hidden <= 4) {
        return false;
    }
    const by = Math.min(LINE_STEP, hidden);
    scrollLines(command === "next" ? by : -by);
    return true;
}

/**
 * Enter on a card whose code is cut short ("Show 12 more lines"): show the
 * rest first, then step in. On a card that shows several blocks of code, the
 * cursor steps into the first block instead of opening the file. True when
 * that was the move.
 */
function enterBlocks(
    command: KeyCommand,
    from: HTMLElement | undefined,
): boolean {
    if (command !== "enter" || !from) {
        return false;
    }
    const more = from.querySelector<HTMLElement>("[data-expand]");
    if (more && !more.closest("[inert]")) {
        more.click();
        // Once drawn: the hidden lines may hold more blocks to step into.
        requestAnimationFrame(() => stepIntoBlocks(from));
        return true;
    }
    return stepIntoBlocks(from);
}

/** Put the cursor on a card's first block. False when it has none to enter. */
function stepIntoBlocks(card: HTMLElement): boolean {
    const first = card.querySelector<HTMLElement>("[data-block]");
    if (!first || first.closest("[inert]")) {
        return false;
    }
    first.focus({ preventScroll: true });
    follow(first);
    return true;
}

/**
 * With the cursor on a block of code: `j` and `k` move between the blocks of
 * its card (staying on the first or last), across files, Enter or `gf` opens
 * the block in its file and `gd` its diff, Escape goes back to the card. True
 * when that was the move.
 */
function moveInBlocks(command: KeyCommand): boolean {
    const block = document.activeElement?.closest<HTMLElement>("[data-block]");
    const card = block?.closest<HTMLElement>("[data-nav]");
    if (!block || !card) {
        return false;
    }
    if (command === "leave") {
        card.focus({ preventScroll: true });
        return true;
    }
    // The block's own file: Enter and `gf` open it, `gd` its diff.
    if (command === "enter" || command === "open" || command === "diff") {
        tell(block, command);
        return true;
    }
    if (command !== "next" && command !== "prev") {
        return false;
    }
    const blocks = blocksOf(card);
    const step = command === "next" ? 1 : -1;
    const target = blocks[blocks.indexOf(block) + step];
    if (target) {
        target.focus({ preventScroll: true });
        follow(target);
    }
    return true;
}

/** The blocks of code a card shows, top to bottom (none with a single block). */
function blocksOf(card: HTMLElement): HTMLElement[] {
    return [...card.querySelectorAll<HTMLElement>("[data-block]")];
}

/** Hand a command to a place, as if its key was pressed there. */
function tell(target: HTMLElement, command: KeyCommand, count = 1): void {
    const detail: Heard = { command, count };
    target.dispatchEvent(new CustomEvent(KEY_EVENT, { detail }));
}

/**
 * `h` and `l`, like a file tree: out of a card to its goal, then folding it;
 * into a goal (unfolding it) to its first step, or unfolding a folded card.
 * True when that was the move.
 */
function moveInTree(
    command: KeyCommand,
    from: HTMLElement | undefined,
): boolean {
    if (!from || (command !== "parent" && command !== "child")) {
        return false;
    }
    const isGoal = from.dataset.nav === "goal";
    if (command === "parent") {
        const goal = from
            .closest("section")
            ?.querySelector<HTMLElement>('[data-nav="goal"]');
        if (isGoal) {
            tell(from, "fold");
        } else {
            // Its header is pinned, so it is in sight: no scrolling.
            goal?.focus({ preventScroll: true });
        }
        return true;
    }
    if (!isGoal) {
        tell(from, "unfold");
        return true;
    }
    tell(from, "unfold");
    // Once drawn unfolded, step into the goal.
    requestAnimationFrame(() =>
        requestAnimationFrame(() => {
            const first = from
                .closest("section")
                ?.querySelector<HTMLElement>('[data-nav="card"]');
            if (first && first.closest("[inert]") === null) {
                first.focus({ preventScroll: true });
                follow(first);
            }
        }),
    );
    return true;
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
