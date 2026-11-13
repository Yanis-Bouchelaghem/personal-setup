import * as z from "zod";

/**
 * The restitution file: what the agent writes and the panel renders.
 * Goals come from the request; steps tell the reader what to read and why.
 */
const LineRange = z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([from, to]) => from <= to, "lines must be [from, to]");

export const StepSchema = z.object({
    why: z.string().min(1),
    /** Path relative to the git root. */
    file: z.string().min(1).optional(),
    /** New-side line range; without it the step covers the whole file's diff. */
    lines: LineRange.optional(),
    because: z.string().min(1).optional(),
});

export const GoalSchema = z.object({
    title: z.string().min(1),
    ref: z.string().min(1).optional(),
    steps: z.array(StepSchema).min(1),
});

export const RestitutionSchema = z.object({
    version: z.literal(1),
    request: z.string().min(1).optional(),
    goals: z.array(GoalSchema).min(1),
});

export type Step = z.infer<typeof StepSchema>;
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
