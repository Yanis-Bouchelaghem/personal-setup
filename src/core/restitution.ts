import * as z from "zod";

/**
 * The restitution file: what the agent writes and the panel renders.
 * Goals come from the request; steps tell the reader what to read and why.
 */
const LineRange = z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([from, to]) => from <= to, "lines must be [from, to]");

/**
 * How a step follows the previous one in its goal. The page reads as one
 * sentence: the step's text continues after the connector word.
 */
export const LINKS = ["then", "so", "in parallel", "finally"] as const;
export type Link = (typeof LINKS)[number];

export const StepSchema = z.object({
    why: z.string().min(1),
    /** Path relative to the git root. */
    file: z.string().min(1).optional(),
    /** New-side line range; without it the step covers the whole file's diff. */
    lines: LineRange.optional(),
    /** Leave out on the first step of a goal; no word means "then". */
    link: z.enum(LINKS).optional(),
});

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
