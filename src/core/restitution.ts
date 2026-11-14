import * as z from "zod";

/**
 * The restitution file: what the agent writes and the panel renders.
 * Goals come from the request; steps tell the reader what to read and why.
 */
const LineRangeSchema = z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([from, to]) => from <= to, "a range must be [from, to]");

/**
 * Concrete data that crosses the boundary with something outside the
 * codebase (an API payload, a file format, CLI output), shown folded in the
 * step whose code handles it.
 */
const ExampleSchema = z.object({
    /** A natural phrase saying what it is and where it comes from: "An example of a plugin the marketplace API could return". */
    title: z.string().min(1),
    /** The data itself, shown verbatim in monospace. */
    body: z.string().min(1),
});

/** A step's fields, before the rule that ties `file` and `lines` together. */
export const StepFieldsSchema = z.object({
    why: z.string().min(1),
    /** Path relative to the git root. */
    file: z.string().min(1).optional(),
    /**
     * Exactly the lines of `file` this step shows, as ranges: the new side,
     * or the old side for a deleted file. Required with `file`.
     */
    lines: z.array(LineRangeSchema).min(1).optional(),
    /**
     * The connector word shown before this step, in the reader's
     * language: the page reads as one sentence, the step's text
     * continuing after it. Free text, so the agent can translate it;
     * the guide defines the meanings. Left out on a goal's first step;
     * no word anywhere else shows "then".
     */
    link: z.string().min(1).optional(),
    examples: z.array(ExampleSchema).min(1).optional(),
});

export const StepSchema = StepFieldsSchema.refine(
    (step) => (step.file === undefined) === (step.lines === undefined),
    {
        message: "file and lines go together: give both, or neither",
        path: ["lines"],
    },
);

export const GoalSchema = z.object({
    title: z.string().min(1),
    ref: z.string().min(1).optional(),
    steps: z.array(StepSchema).min(1),
});

export const RestitutionSchema = z.object({
    version: z.literal(1),
    /** Short tab name; defaults to the request, then the first goal. */
    label: z.string().min(1).optional(),
    request: z.string().min(1).optional(),
    goals: z.array(GoalSchema).min(1),
});

export type Step = z.infer<typeof StepSchema>;
export type StepExample = z.infer<typeof ExampleSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Restitution = z.infer<typeof RestitutionSchema>;

export type ParseResult =
    | { ok: true; value: Restitution }
    | { ok: false; errors: string[] };

/** Parse and validate the text of a restitution file. */
export function parseRestitution(text: string): ParseResult {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, errors: [`Not valid JSON: ${reason}`] };
    }
    const result = RestitutionSchema.safeParse(json);
    if (result.success) {
        return { ok: true, value: result.data };
    }
    return {
        ok: false,
        errors: result.error.issues.map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        ),
    };
}

/** The name shown on the restitution's tab. */
export function tabLabel(restitution: Restitution): string {
    return (
        restitution.label ??
        restitution.request ??
        restitution.goals[0]?.title ??
        "Restitution"
    );
}
