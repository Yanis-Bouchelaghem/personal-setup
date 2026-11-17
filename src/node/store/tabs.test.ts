import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { stepFingerprint } from "../../core/fingerprint";
import { addAnswers } from "./answers";
import { restitutionDir } from "./paths";
import { updateReview } from "./review";
import { readTabs, writeRestitution } from "./tabs";
import { restitutionFor, testRepo } from "./testRepo";

describe("tabs", () => {
    it("writes one file per restitution and lists them newest first", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "first", restitutionFor("a.ts", "First"));
        await writeRestitution(dir, "second", restitutionFor("b.ts"));
        utimesSync(join(restitutionDir(dir), "first.json"), 1000, 1000);

        const tabs = await readTabs(dir);
        expect(tabs.map((tab) => tab.id)).toEqual(["second", "first"]);
        expect(tabs.map((tab) => tab.label)).toEqual(["Change b.ts", "First"]);
    });

    it("ignores review files, temporary files, dotfiles and the archive", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "real", restitutionFor("a.ts"));
        const folder = restitutionDir(dir);
        writeFileSync(join(folder, "real.review.json"), "{}");
        writeFileSync(join(folder, "real.json.123.tmp"), "{");
        writeFileSync(join(folder, ".hidden.json"), "{}");
        mkdirSync(join(folder, "archive"));
        writeFileSync(join(folder, "archive", "old.json"), "{}");

        expect((await readTabs(dir)).map((tab) => tab.id)).toEqual(["real"]);
    });

    it("keeps a broken file as its own error tab", async () => {
        const dir = testRepo();
        await writeRestitution(dir, "good", restitutionFor("a.ts"));
        writeFileSync(join(restitutionDir(dir), "bad.json"), "{ nope");

        const tabs = await readTabs(dir);
        expect(tabs.find((tab) => tab.id === "bad")?.kind).toBe("error");
        expect(tabs.find((tab) => tab.id === "good")?.kind).toBe("ok");
    });

    it("reads an empty or missing folder as no tabs", async () => {
        expect(await readTabs(testRepo())).toEqual([]);
    });

    it("rejects ids that could escape the folder", async () => {
        await expect(
            writeRestitution(testRepo(), "../evil", restitutionFor("a.ts")),
        ).rejects.toThrow();
    });

    it("moves an answered comment to its answer, keeping a clarify open", async () => {
        const dir = testRepo();
        const restitution = restitutionFor("a.ts");
        await writeRestitution(dir, "t", restitution);
        const step = stepFingerprint(restitution.goals[0]!.steps[0]!);
        await updateReview(dir, "t", {
            type: "request",
            step,
            label: "1.1",
            clarify: true,
            comment: "Why here?",
        });
        await updateReview(dir, "t", { type: "sent", at: Date.now() + 1000 });
        await addAnswers(dir, "t", [
            {
                id: "a1",
                step,
                label: "1.1",
                comment: "Why here?",
                answer: "Because.",
                at: Date.now() + 2000,
            },
        ]);

        const [tab] = await readTabs(dir);
        if (tab?.kind !== "ok") {
            throw new Error("expected a tab");
        }
        expect(tab.answers.map((answer) => answer.answer)).toEqual([
            "Because.",
        ]);
        expect(tab.requests).toEqual([
            expect.objectContaining({ clarify: true, comment: undefined }),
        ]);
    });
});
