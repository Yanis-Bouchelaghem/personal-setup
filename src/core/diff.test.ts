import { describe, expect, it } from "vitest";

import {
    changedRanges,
    countLines,
    hunkSelection,
    parseUnifiedDiff,
    selectLines,
    takeLines,
} from "./diff";

const DIFF = `diff --git a/src/config.ts b/src/config.ts
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
diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-gone one
-gone two
`;

const [config, added, deleted] = parseUnifiedDiff(DIFF);

describe("parseUnifiedDiff", () => {
    it("finds each file and its status", () => {
        expect(
            [config, added, deleted].map((f) => [f?.file, f?.status]),
        ).toEqual([
            ["src/config.ts", "modified"],
            ["src/new.ts", "added"],
            ["src/old.ts", "deleted"],
        ]);
    });

    it("splits hunks and numbers lines on both sides", () => {
        expect(config?.hunks).toHaveLength(2);
        expect(config?.hunks[0]?.lines).toEqual([
            { kind: "ctx", text: "const a = 1;", oldNo: 10, newNo: 10, at: 10 },
            { kind: "del", text: "const url = raw;", oldNo: 11, at: 10 },
            {
                kind: "add",
                text: "const url = new URL(raw);",
                newNo: 11,
                at: 11,
            },
            { kind: "add", text: "assertHttps(url);", newNo: 12, at: 12 },
            { kind: "ctx", text: "const b = 2;", oldNo: 12, newNo: 13, at: 13 },
        ]);
    });

    it("ignores the no-newline marker", () => {
        expect(added?.hunks[0]?.lines).toHaveLength(2);
    });

    it("returns nothing for empty output", () => {
        expect(parseUnifiedDiff("")).toEqual([]);
    });
});

describe("where a line sits (`at`)", () => {
    it("puts a removed line beside the line before it", () => {
        const removed = config?.hunks[0]?.lines.find((l) => l.kind === "del");
        expect(removed?.at).toBe(10);
    });

    it("puts a removal at the start of a hunk at the hunk's start", () => {
        const removed = config?.hunks[1]?.lines.find((l) => l.kind === "del");
        expect(removed?.at).toBe(41);
    });

    it("uses the old-side numbers for a deleted file", () => {
        expect(deleted?.hunks[0]?.lines.map((l) => l.at)).toEqual([1, 2]);
    });
});

describe("selectLines", () => {
    it("shows exactly the lines in the range, cut out of their hunk", () => {
        const hunks = selectLines(config, [[11, 12]]);
        expect(hunks).toHaveLength(1);
        expect(hunks[0]?.lines.map((l) => l.text)).toEqual([
            "const url = new URL(raw);",
            "assertHttps(url);",
        ]);
        expect(hunks[0]?.newStart).toBe(11);
    });

    it("takes a removed line along with its neighbour", () => {
        const hunks = selectLines(config, [[10, 11]]);
        expect(hunks[0]?.lines.map((l) => l.kind)).toEqual([
            "ctx",
            "del",
            "add",
        ]);
    });

    it("splits into runs when a range leaves lines out", () => {
        const hunks = selectLines(config, [
            [10, 10],
            [12, 12],
        ]);
        expect(hunks.map((h) => h.lines.map((l) => l.kind))).toEqual([
            ["ctx", "del"],
            ["add"],
        ]);
    });

    it("keeps the diff's own line objects", () => {
        const [hunk] = selectLines(config, [[11, 12]]);
        expect(hunk?.lines[0]).toBe(config?.hunks[0]?.lines[2]);
    });

    it("selects across hunks and for new and deleted files", () => {
        expect(selectLines(config, [[1, 100]])).toHaveLength(2);
        expect(selectLines(added, [[1, 1]])[0]?.lines).toHaveLength(1);
        expect(selectLines(deleted, [[1, 2]])[0]?.lines).toHaveLength(2);
    });

    it("shows nothing for a missing file or lines outside every hunk", () => {
        expect(selectLines(undefined, [[1, 5]])).toEqual([]);
        expect(selectLines(config, [[200, 210]])).toEqual([]);
        expect(selectLines(config, [])).toEqual([]);
    });
});

describe("takeLines / countLines", () => {
    const hunks = config?.hunks ?? [];

    it("limits lines across hunks", () => {
        const limited = takeLines(hunks, 6);
        expect(countLines(limited)).toBe(6);
        expect(limited).toHaveLength(2);
    });
});

describe("changedRanges", () => {
    it("is only the added lines among the lines shown, not the context", () => {
        const shown = selectLines(config, [[10, 13]]);
        expect(changedRanges(shown)).toEqual([[11, 12]]);
    });

    it("keeps changes separated by unchanged code apart", () => {
        expect(changedRanges(selectLines(config, [[1, 100]]))).toEqual([
            [11, 12],
            [41, 41],
        ]);
        const gap = parseUnifiedDiff(
            "diff --git a/g.ts b/g.ts\n--- a/g.ts\n+++ b/g.ts\n@@ -1,3 +1,5 @@\n+first\n keep\n+second\n+third\n tail\n",
        )[0];
        expect(changedRanges(selectLines(gap, [[1, 10]]))).toEqual([
            [1, 1],
            [3, 4],
        ]);
    });

    it("treats a replaced line as one change", () => {
        const [hunk] = selectLines(config, [[10, 11]]);
        expect(hunk?.lines.map((l) => l.kind)).toEqual(["ctx", "del", "add"]);
        expect(changedRanges([hunk!])).toEqual([[11, 11]]);
    });

    it("covers a whole new file", () => {
        expect(changedRanges(selectLines(added, [[1, 2]]))).toEqual([[1, 2]]);
    });

    it("has nothing for a step that only removes code", () => {
        expect(changedRanges(selectLines(deleted, [[1, 2]]))).toEqual([]);
    });
});

const line = (kind: "add" | "del" | "ctx", at: number) => ({
    kind,
    text: "",
    at,
    ...(kind === "del" ? { oldNo: at } : { newNo: at }),
});

const hunk = (lines: ReturnType<typeof line>[]) => ({
    oldStart: 1,
    newStart: lines[0]?.at ?? 0,
    newLines: lines.length,
    lines,
});

describe("hunkSelection", () => {
    it("selects only the changed lines of a block", () => {
        expect(
            hunkSelection(
                hunk([
                    line("ctx", 4),
                    line("add", 5),
                    line("add", 6),
                    line("ctx", 7),
                ]),
            ),
        ).toEqual([[5, 6]]);
    });

    it("selects the whole block when nothing new is in it", () => {
        expect(hunkSelection(hunk([line("ctx", 8), line("ctx", 9)]))).toEqual([
            [8, 9],
        ]);
        expect(hunkSelection(hunk([line("ctx", 3), line("del", 3)]))).toEqual([
            [3, 3],
        ]);
    });
});
