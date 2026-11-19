/**
 * The panel's keys, vim style: a key or a short sequence ("gg", "zc") names
 * a command. Plain data, so the help lists exactly what works.
 */
export type KeyCommand =
    | "next"
    | "prev"
    | "parent"
    | "child"
    | "nextGoal"
    | "prevGoal"
    | "first"
    | "last"
    | "halfDown"
    | "halfUp"
    | "open"
    | "diff"
    | "toggle"
    | "examples"
    | "docs"
    | "fold"
    | "unfold"
    | "foldAll"
    | "unfoldAll"
    | "clarify"
    | "comment"
    | "resolve"
    | "copy"
    | "nextChange"
    | "prevChange"
    | "nextTab"
    | "prevTab"
    | "help"
    | "leave";

/** Sections of the help, in order; the first key of each row is the one shown first. */
export const KEYMAP: readonly {
    title: string;
    rows: readonly {
        keys: readonly string[];
        command: KeyCommand;
        does: string;
    }[];
}[] = [
    {
        title: "Move",
        rows: [
            {
                keys: ["j", "ArrowDown", "ctrl+j"],
                command: "next",
                does: "Down: through a long card, then the next",
            },
            {
                keys: ["k", "ArrowUp", "ctrl+k"],
                command: "prev",
                does: "Up",
            },
            {
                keys: ["h", "ArrowLeft"],
                command: "parent",
                does: "Out: to the goal, then fold it",
            },
            {
                keys: ["l", "ArrowRight"],
                command: "child",
                does: "In: unfold, then the first step",
            },
            { keys: ["}"], command: "nextGoal", does: "Next goal" },
            { keys: ["{"], command: "prevGoal", does: "Previous goal" },
            { keys: ["gg"], command: "first", does: "First" },
            { keys: ["G"], command: "last", does: "Last" },
            { keys: ["ctrl+d"], command: "halfDown", does: "Half a page down" },
            { keys: ["ctrl+u"], command: "halfUp", does: "Half a page up" },
            {
                keys: ["]c"],
                command: "nextChange",
                does: "Next change or answer",
            },
            {
                keys: ["[c"],
                command: "prevChange",
                does: "Previous change or answer",
            },
            { keys: ["gt"], command: "nextTab", does: "Next tab" },
            { keys: ["gT"], command: "prevTab", does: "Previous tab" },
        ],
    },
    {
        title: "Act",
        rows: [
            { keys: ["Enter", "gf"], command: "open", does: "Open the file" },
            { keys: ["gd"], command: "diff", does: "Open the diff" },
            {
                keys: ["e"],
                command: "examples",
                does: "Open or close the examples",
            },
            {
                keys: ["gx"],
                command: "docs",
                does: "Open the docs link (2gx: the second)",
            },
            {
                keys: ["a", "za"],
                command: "toggle",
                does: "Fold or unfold (mark viewed)",
            },
            { keys: ["zc"], command: "fold", does: "Fold (mark viewed)" },
            { keys: ["zo"], command: "unfold", does: "Unfold" },
            { keys: ["zC", "zM"], command: "foldAll", does: "Fold every goal" },
            {
                keys: ["zO", "zR"],
                command: "unfoldAll",
                does: "Unfold every goal",
            },
        ],
    },
    {
        title: "Ask the agent",
        rows: [
            { keys: ["c", "i"], command: "comment", does: "Write a comment" },
            { keys: ["m"], command: "clarify", does: "Mark for clarification" },
            {
                keys: ["r"],
                command: "resolve",
                does: "Resolve the agent's answers",
            },
            { keys: ["Y"], command: "copy", does: "Copy for agent" },
        ],
    },
    {
        title: "Panel",
        rows: [
            { keys: ["?"], command: "help", does: "Show or hide these keys" },
            { keys: ["Escape"], command: "leave", does: "Back to the editor" },
        ],
    },
];

const BINDINGS: ReadonlyMap<string, KeyCommand> = new Map(
    KEYMAP.flatMap((section) =>
        section.rows.flatMap((row) =>
            row.keys.map((key) => [key, row.command] as const),
        ),
    ),
);

/** Like vim's 'timeoutlen': a sequence left unfinished this long is dropped. */
const SEQUENCE_MS = 1000;

/** The name a key goes by in the keymap: "j", "G", "ctrl+d", "Escape". */
export function keyName(event: { key: string; ctrlKey: boolean }): string {
    return event.ctrlKey ? `ctrl+${event.key.toLowerCase()}` : event.key;
}

/** The keys that start a two-key sequence: "g" of "gg", "z" of "zc". */
const PREFIXES: ReadonlySet<string> = new Set(
    [...BINDINGS.keys()]
        // Named keys ("Enter", "ctrl+d") are longer; sequences are two keys.
        .filter((key) => key.length === 2)
        .map((key) => key.charAt(0)),
);

/** A command, and how many times (a count typed before it, like `3j`). */
export type KeyRead = { command: KeyCommand; count: number };

/** A count is capped: `999j` is a slip, not a wish. */
const MAX_COUNT = 99;

/**
 * Turns keys into commands, one at a time, like vim: digits first make a
 * count, then a key or a two-key sequence names the command. "pending" means
 * more is expected; undefined means the keys meant nothing.
 */
export function keyReader(): (
    name: string,
    now: number,
) => KeyRead | "pending" | undefined {
    let prefix = "";
    let count = 0;
    let last = 0;
    return (name, now) => {
        if (now - last > SEQUENCE_MS) {
            prefix = "";
            count = 0;
        }
        last = now;
        // A count: 1-9 starts it, 0 only continues it.
        if (!prefix && /^[0-9]$/.test(name) && (name !== "0" || count > 0)) {
            count = Math.min(MAX_COUNT, count * 10 + Number(name));
            return "pending";
        }
        const started = prefix;
        prefix = "";
        if (!started && PREFIXES.has(name)) {
            prefix = name;
            return "pending";
        }
        // A sequence that goes nowhere ("gq") is dropped, like in vim.
        const command = BINDINGS.get(started + name);
        const read = command && { command, count: Math.max(1, count) };
        count = 0;
        return read;
    };
}
