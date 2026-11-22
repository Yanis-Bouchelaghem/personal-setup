const UNITS: [
    limit: number,
    seconds: number,
    unit: Intl.RelativeTimeFormatUnit,
][] = [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [Infinity, 86400, "day"],
];

/** "5 minutes ago", "yesterday": for lists where exact times are noise. */
export function timeAgo(then: number, now: number): string {
    const seconds = Math.max(0, Math.round((now - then) / 1000));
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [limit, size, unit] of UNITS) {
        if (seconds < limit) {
            return formatter.format(-Math.floor(seconds / size), unit);
        }
    }
    return "";
}
