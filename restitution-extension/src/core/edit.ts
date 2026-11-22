import * as z from "zod";

import {
    type Goal,
    GoalSchema,
    type ParseResult,
    type Restitution,
    RestitutionSchema,
    type Step,
    StepFieldsSchema,
    StepSchema,
} from "./restitution";

/**
 * Partial updates to a restitution: change, split, add or remove steps and
 * goals without resubmitting the rest. Every label and goal number refers to
 * the restitution as it was before the edit, so edits never have to account
 * for each other's renumbering.
 */
const Label = z
    .string()
    .regex(/^\d+\.\d+$/, 'a step label, like "2.1"')
    .describe('A step label as shown to the user, like "2.1".');
const GoalNumber = z
    .number()
    .int()
    .positive()
    .describe("A goal number, from 1.");

export const EditSchema = z.discriminatedUnion("op", [
    z
        .object({
            op: z.literal("set"),
            step: Label,
            fields: StepFieldsSchema.partial(),
        })
        .describe("Change some fields of a step; the others stay as they are."),
    z
        .object({
            op: z.literal("replace"),
            step: Label,
            steps: z.array(StepSchema),
        })
        .describe(
            "Replace a step with these steps: several to split it (clarify), one to rewrite it, none to remove it.",
        ),
    z
        .object({
            op: z.literal("insert"),
            after: Label.optional(),
            before: Label.optional(),
            steps: z.array(StepSchema).min(1),
        })
        .describe('Add steps "after" or "before" a step.'),
    z
        .object({
            op: z.literal("setGoal"),
            goal: GoalNumber,
            title: z.string().min(1).optional(),
            ref: z.string().min(1).optional(),
        })
        .describe("Change a goal's title or ref."),
    z
        .object({ op: z.literal("removeGoal"), goal: GoalNumber })
        .describe("Remove a goal and its steps."),
    z
        .object({
            op: z.literal("addGoal"),
            goal: GoalSchema,
            after: z
                .number()
                .int()
                .min(0)
                .optional()
                .describe(
                    "The goal it comes after; 0 puts it first. Default: last.",
                ),
        })
        .describe("Add a goal."),
]);

export type Edit = z.infer<typeof EditSchema>;

/** One original step and what takes its place. */
type Cell = { before: Step[]; items: Step[]; after: Step[]; replaced: boolean };

type Work = {
    title: string;
    ref?: string;
    cells: Cell[];
    removed: boolean;
};

/** Apply edits to a restitution; nothing applies if any of them is wrong. */
export function applyEdits(
    restitution: Restitution,
    edits: readonly Edit[],
): ParseResult {
    const goals: Work[] = restitution.goals.map((goal) => ({
        title: goal.title,
        ref: goal.ref,
        removed: false,
        cells: goal.steps.map((step) => ({
            before: [],
            items: [step],
            after: [],
            replaced: false,
        })),
    }));
    // Goals added after original goal k (0 = before the first).
    const added: Goal[][] = goals.map(() => []).concat([[]]);
    const errors: string[] = [];

    const cellAt = (label: string): Cell | undefined => {
        const [goal, step] = label.split(".").map(Number);
        const cell = goals[(goal ?? 0) - 1]?.cells[(step ?? 0) - 1];
        if (!cell) {
            errors.push(`There is no step ${label}.`);
        }
        return cell;
    };
    const goalAt = (number: number): Work | undefined => {
        const goal = goals[number - 1];
        if (!goal) {
            errors.push(`There is no goal ${number}.`);
        }
        return goal;
    };

    for (const edit of edits) {
        applyOne(edit, { cellAt, goalAt, added, errors, count: goals.length });
    }
    if (errors.length > 0) {
        return { ok: false, errors };
    }

    const result = {
        ...restitution,
        goals: [
            ...(added[0] ?? []),
            ...goals.flatMap((goal, index) => [
                ...(goal.removed
                    ? []
                    : [
                          {
                              title: goal.title,
                              ...(goal.ref ? { ref: goal.ref } : {}),
                              steps: goal.cells.flatMap((cell) => [
                                  ...cell.before,
                                  ...cell.items,
                                  ...cell.after,
                              ]),
                          },
                      ]),
                ...(added[index + 1] ?? []),
            ]),
        ],
    };
    const parsed = RestitutionSchema.safeParse(result);
    return parsed.success
        ? { ok: true, value: parsed.data }
        : {
              ok: false,
              errors: parsed.error.issues.map(
                  (issue) =>
                      `After the edits, ${issue.path.join(".") || "(root)"}: ${issue.message}`,
              ),
          };
}

type Context = {
    cellAt: (label: string) => Cell | undefined;
    goalAt: (number: number) => Work | undefined;
    added: Goal[][];
    errors: string[];
    count: number;
};

type Of<K extends Edit["op"]> = Extract<Edit, { op: K }>;

function changeStep(edit: Of<"set"> | Of<"replace">, context: Context): void {
    const cell = context.cellAt(edit.step);
    if (!cell) {
        return;
    }
    if (cell.replaced) {
        context.errors.push(
            `Step ${edit.step} is replaced twice; use one edit.`,
        );
    } else if (edit.op === "replace") {
        cell.items = edit.steps;
        cell.replaced = true;
    } else {
        cell.items = cell.items.map((step) => ({ ...step, ...edit.fields }));
    }
}

function insertSteps(edit: Of<"insert">, context: Context): void {
    const label = edit.after ?? edit.before;
    if (!label || (edit.after && edit.before)) {
        context.errors.push(
            'An insert needs exactly one of "after" or "before".',
        );
        return;
    }
    context
        .cellAt(label)
        ?.[edit.after ? "after" : "before"].push(...edit.steps);
}

function changeGoal(
    edit: Of<"setGoal"> | Of<"removeGoal">,
    context: Context,
): void {
    const goal = context.goalAt(edit.goal);
    if (!goal) {
        return;
    }
    if (edit.op === "removeGoal") {
        goal.removed = true;
    } else {
        goal.title = edit.title ?? goal.title;
        goal.ref = edit.ref ?? goal.ref;
    }
}

function addGoal(edit: Of<"addGoal">, context: Context): void {
    const after = edit.after ?? context.count;
    if (after > context.count) {
        context.errors.push(`There is no goal ${after} to add a goal after.`);
        return;
    }
    context.added[after]?.push(edit.goal);
}

function applyOne(edit: Edit, context: Context): void {
    if (edit.op === "set" || edit.op === "replace") {
        changeStep(edit, context);
    } else if (edit.op === "insert") {
        insertSteps(edit, context);
    } else if (edit.op === "setGoal" || edit.op === "removeGoal") {
        changeGoal(edit, context);
    } else {
        addGoal(edit, context);
    }
}

/** The steps with their labels, one per line: what the agent edits next. */
export function outline(restitution: Restitution): string {
    return restitution.goals
        .flatMap((goal, g) => [
            `${g + 1}. ${goal.title}`,
            ...goal.steps.map((step, s) => {
                const where =
                    step.file && step.lines
                        ? ` ${step.file}:${step.lines.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(",")}`
                        : "";
                const link = step.link && s > 0 ? ` [${step.link}]` : "";
                return `  ${g + 1}.${s + 1}${link}${where}: ${step.why}`;
            }),
        ])
        .join("\n");
}
