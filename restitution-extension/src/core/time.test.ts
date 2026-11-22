import { describe, expect, it } from "vitest";

import { timeAgo } from "./time";

const NOW = 1_000_000_000_000;

describe("timeAgo", () => {
    it("reads naturally at each scale", () => {
        expect(timeAgo(NOW - 5_000, NOW)).toBe("5 seconds ago");
        expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
        expect(timeAgo(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
        expect(timeAgo(NOW - 86_400_000, NOW)).toBe("yesterday");
        expect(timeAgo(NOW - 4 * 86_400_000, NOW)).toBe("4 days ago");
    });

    it("never says the future", () => {
        expect(timeAgo(NOW + 10_000, NOW)).toBe("now");
    });
});
