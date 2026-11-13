const counters = new Map<string, number>();

export function increment(name: string, by = 1): void {
    counters.set(name, (counters.get(name) ?? 0) + by);
}

export function snapshot(): Record<string, number> {
    return Object.fromEntries(counters);
}

export function recordRetry(attempt: number): void {
    increment("gateway_retries_total");
    increment(`gateway_retry_attempt_${attempt}`);
}
