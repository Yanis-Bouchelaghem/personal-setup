import * as z from "zod";

import { stepFingerprint } from "./fingerprint";
import type { Restitution } from "./restitution";
import type { ReviewRequest } from "./review";

/**
 * The agent's answers to the reader's comments, shown under the comment on
 * its step instead of only in the agent's chat reply. Written by the MCP
 * server (`restitution_answer`), next to the restitution; the reader resolves
 * them in the panel (that lives in the review, which only the extension
 * writes).
 */
const AnswerSchema = z.object({
    id: z.string(),
    /** Fingerprint of the step it is on, when it was answered. */
    step: z.string(),
    /** That step's label then, in case the step has changed since. */
    label: z.string(),
    /** The reader's comment, word for word. */
    comment: z.string(),
    answer: z.string(),
    at: z.number(),
});

const AnswersSchema = z.object({
    version: z.literal(1),
    answers: z.array(AnswerSchema),
});

export type Answer = z.infer<typeof AnswerSchema>;

/** Tolerant: a missing or damaged file is no answers. */
export function parseAnswers(text: string): Answer[] {
    try {
        const parsed = AnswersSchema.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data.answers : [];
    } catch {
        return [];
    }
}

export function serializeAnswers(answers: readonly Answer[]): string {
    return `${JSON.stringify({ version: 1, answers }, null, 4)}\n`;
}

function plain(text: string): string {
    return text.trim().replace(/\s+/g, " ");
}

/** Comments compare by their words, not their spacing. */
function same(a: string, b: string): boolean {
    return plain(a) === plain(b);
}

/**
 * Whether a comment has been answered since it was sent: same step, or the
 * same words (the agent may have changed the step while answering).
 */
export function isAnswered(
    request: ReviewRequest,
    answers: readonly Answer[],
): boolean {
    const { comment, sentAt } = request;
    if (!comment || sentAt === undefined) {
        return false;
    }
    return answers.some(
        (answer) =>
            answer.at >= sentAt &&
            (answer.step === request.step || same(answer.comment, comment)),
    );
}

/**
 * The answers to show on a step: those written on it, or, for an answer
 * whose step has changed since, the step that now has its label.
 */
export function answersOn(
    answers: readonly Answer[],
    fingerprint: string,
    label: string,
    fingerprints: ReadonlySet<string>,
): Answer[] {
    return answers.filter(
        (answer) =>
            answer.step === fingerprint ||
            (!fingerprints.has(answer.step) && answer.label === label),
    );
}

/** What the agent sends: the comment it answers, on a step by its label now. */
export type AnswerInput = { step: string; comment: string; answer: string };

/**
 * Turn the agent's answers into stored ones, pinned to the steps as they are
 * now; nothing is kept if any label is wrong.
 */
export function pinAnswers(
    restitution: Restitution,
    inputs: readonly AnswerInput[],
    at: number,
    newId: () => string,
): { ok: true; answers: Answer[] } | { ok: false; errors: string[] } {
    const errors: string[] = [];
    const answers = inputs.flatMap((input) => {
        const [goal = 0, step = 0] = input.step.split(".").map(Number);
        const found = restitution.goals[goal - 1]?.steps[step - 1];
        if (!found) {
            errors.push(`There is no step ${input.step}.`);
            return [];
        }
        return [
            {
                id: newId(),
                step: stepFingerprint(found),
                label: input.step,
                comment: input.comment.trim(),
                answer: input.answer.trim(),
                at,
            },
        ];
    });
    return errors.length > 0 ? { ok: false, errors } : { ok: true, answers };
}
