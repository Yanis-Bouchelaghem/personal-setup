import { GatewayError } from "../errors.js";
import { recordRetry } from "../telemetry/metrics.js";

export interface RetryOptions {
    attempts?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Server errors are worth another try; anything else is the caller's problem. */
function isTransient(error: unknown): boolean {
    return error instanceof GatewayError && error.upstreamStatus >= 500;
}

export async function withRetry<T>(
    action: () => Promise<T>,
    { attempts = 3, baseDelayMs = 200, shouldRetry = isTransient }: RetryOptions = {},
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await action();
        } catch (error) {
            lastError = error;
            if (attempt === attempts || !shouldRetry(error)) {
                throw error;
            }
            recordRetry(attempt);
            await sleep(baseDelayMs * 2 ** (attempt - 1));
        }
    }
    throw lastError;
}
