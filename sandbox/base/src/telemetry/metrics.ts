const counters = new Map<string, number>();

export function increment(name: string, by = 1): void {
    counters.set(name, (counters.get(name) ?? 0) + by);
}

export function snapshot(): Record<string, number> {
    return Object.fromEntries(counters);
}
