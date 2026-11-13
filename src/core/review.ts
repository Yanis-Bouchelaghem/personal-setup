import * as z from "zod";

/**
 * The human's side of a restitution: which steps they marked Viewed, by
 * fingerprint. It lives next to the agent's file, never inside it, so an
 * agent rewriting its restitution can't wipe it.
 */
const ReviewSchema = z.object({
    version: z.literal(1),
    viewed: z.array(z.string()),
});

/** Tolerant: a missing or damaged file just means nothing is viewed. */
export function parseViewed(text: string): string[] {
    try {
        const parsed = ReviewSchema.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data.viewed : [];
    } catch {
        return [];
    }
}

export function withViewed(
    viewed: string[],
    fingerprint: string,
    on: boolean,
): string[] {
    const others = viewed.filter((existing) => existing !== fingerprint);
    return on ? [...others, fingerprint] : others;
}

export function serializeReview(viewed: string[]): string {
    return `${JSON.stringify({ version: 1, viewed }, null, 4)}\n`;
}
