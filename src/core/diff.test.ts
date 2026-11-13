import { describe, expect, it } from "vitest";

import {
    countLines,
    firstChangedLine,
    hunksForRange,
    parseUnifiedDiff,
    takeLines,
} from "./diff";

const MODIFIED = `diff --git a/src/config.ts b/src/config.ts
index 111..222 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,4 +10,5 @@ export const config = {
 const a = 1;
-const url = raw;
+const url = new URL(raw);
+assertHttps(url);
 const b = 2;
@@ -40,2 +41,2 @@ function other() {
-  return 1;
+  return 2;
 }
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const x = 1;
+export const y = 2;
\\ No newline at end of file
`;

describe("parseUnifiedDiff", () => {
    const files = parseUnifiedDiff(MODIFIED);

    it("finds each file and its status", () => {
        expect(files.map((f) => [f.file, f.status])).toEqual([
            ["src/config.ts", "modified"],
            ["src/new.ts", "added"],
        ]);
    });

    it("splits hunks and numbers lines on both sides", () => {
        const hunks = files[0]!.hunks;
        expect(hunks).toHaveLength(2);
        expect(hunks[0]!.lines).toEqual([
            { kind: "ctx", text: "const a = 1;", oldNo: 10, newNo: 10 },
            { kind: "del", text: "const url = raw;", oldNo: 11 },
            { kind: "add", text: "const url = new URL(raw);", newNo: 11 },
            { kind: "add", text: "assertHttps(url);", newNo: 12 },
            { kind: "ctx", text: "const b = 2;", oldNo: 12, newNo: 13 },
        ]);
    });

    it("ignores the no-newline marker", () => {
        expect(files[1]!.hunks[0]!.lines).toHaveLength(2);
    });

    it("returns nothing for empty output", () => {
        expect(parseUnifiedDiff("")).toEqual([]);
    });
});

describe("hunksForRange", () => {
    const diff = parseUnifiedDiff(MODIFIED)[0];

    it("returns every hunk without a range", () => {
        expect(hunksForRange(diff)).toHaveLength(2);
    });

    it("keeps only hunks touching the range", () => {
        const picked = hunksForRange(diff, [41, 42]);
        expect(picked).toHaveLength(1);
        expect(picked[0]!.newStart).toBe(41);
    });

    it("returns nothing for a missing file or a range outside any hunk", () => {
        expect(hunksForRange(undefined)).toEqual([]);
        expect(hunksForRange(diff, [200, 210])).toEqual([]);
    });
});

describe("takeLines / countLines / firstChangedLine", () => {
    const hunks = parseUnifiedDiff(MODIFIED)[0]!.hunks;

    it("limits lines across hunks", () => {
        const limited = takeLines(hunks, 6);
        expect(countLines(limited)).toBe(6);
        expect(limited).toHaveLength(2);
    });

    it("lands on the first added line", () => {
        expect(firstChangedLine(hunks)).toBe(11);
        expect(firstChangedLine([])).toBeUndefined();
    });
});
