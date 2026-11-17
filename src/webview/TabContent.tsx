import { useEffect, useState } from "react";

import { type Answer, answerKey, answersOn } from "../core/answers";
import type { Uncovered } from "../core/coverage";
import type { FileDiff } from "../core/diff";
import { feedbackPrompt } from "../core/feedback";
import {
    codeDigest,
    isStale,
    stepFingerprint,
    stepHunks,
} from "../core/fingerprint";
import type { Tab } from "../core/messages";
import type { Restitution } from "../core/restitution";
import type { Review } from "../core/review";
import type { SourceLines } from "../core/source";
import { ChangesPill } from "./ChangesPill";
import { ErrorList } from "./ErrorList";
import { FeedbackBar, useCopied } from "./FeedbackBar";
import { GoalSection, type StepState } from "./GoalSection";
import type { Host } from "./host";
import { KeyHelp } from "./KeyHelp";
import { Notice } from "./Notice";
import { Overview } from "./Overview";
import { scrollToElement } from "./scrollTo";
import { countChanged, UncoveredSection } from "./UncoveredSection";
import { useGoalFolding } from "./useGoalFolding";
import { jumpToChange, useKeyboard } from "./useKeyboard";
import { useReview } from "./useReview";

/** Where every step stands for the reader, goal by goal. */
function stepStates(
    restitution: Restitution,
    diffs: Record<string, FileDiff>,
    review: Review,
    code: Record<string, string>,
    answers: readonly Answer[],
): StepState[][] {
    const viewed = new Set(review.viewed);
    // Before the first look nothing is "updated": it is all new.
    const known = review.known && new Set(review.known);
    const isNew = (key: string) => known !== undefined && !known.has(key);
    // Resolving an answer means you read it.
    const resolved = new Set(review.resolved);
    const fingerprints = new Set(
        restitution.goals.flatMap((goal) => goal.steps.map(stepFingerprint)),
    );
    return restitution.goals.map((goal, g) =>
        goal.steps
            .map((step, s) => ({
                step,
                fingerprint: stepFingerprint(step),
                label: `${g + 1}.${s + 1}`,
            }))
            .map(({ step, fingerprint, label }) => {
                const on = answersOn(answers, fingerprint, label, fingerprints);
                const newAnswers = on
                    .filter(
                        (answer) =>
                            !resolved.has(answer.id) &&
                            isNew(answerKey(answer.id)),
                    )
                    .map((answer) => answer.id);
                const changed = isNew(fingerprint);
                return {
                    fingerprint,
                    viewed: viewed.has(fingerprint),
                    updated: changed || newAnswers.length > 0,
                    changed,
                    answers: on,
                    newAnswers,
                    stale: isStale(
                        code[fingerprint],
                        codeDigest(stepHunks(step, diffs)),
                    ),
                    request: review.requests.find(
                        (request) => request.step === fingerprint,
                    ),
                };
            }),
    );
}

/** One restitution: the request, an overview of its goals, and the goals. */
export function TabContent({
    tab,
    diffs,
    sources,
    uncovered,
    host,
    onCycleTab,
}: {
    tab: Tab;
    diffs: Record<string, FileDiff>;
    /** Unchanged code steps point at. */
    sources: Record<string, SourceLines>;
    /** Uncommitted changes no guide shows. */
    uncovered: readonly Uncovered[];
    host: Host;
    /** Go to the next (1) or previous (-1) tab. */
    onCycleTab: (by: number) => void;
}) {
    const [showUncovered, setShowUncovered] = useState(false);
    const { review, act, copy } = useReview(tab, host);
    const states =
        tab.kind === "ok"
            ? stepStates(tab.restitution, diffs, review, tab.code, tab.answers)
            : [];
    const folding = useGoalFolding(
        states.map((goal) => goal.every((state) => state.viewed)),
    );
    const firstLook = tab.kind === "ok" && review.known === undefined;

    // The first look at a tab: everything on it counts as already shown.
    useEffect(() => {
        if (firstLook) {
            act({
                type: "known",
                steps: [
                    ...states.flat().map((state) => state.fingerprint),
                    ...tab.answers.map((answer) => answerKey(answer.id)),
                ],
            });
        }
    }, [firstLook]);

    // A request keeps the label it was written with, unless its step moved.
    const labels = new Map(
        states.flatMap((goal, goalIndex) =>
            goal.map(
                (state, stepIndex) =>
                    [
                        state.fingerprint,
                        `${goalIndex + 1}.${stepIndex + 1}`,
                    ] as const,
            ),
        ),
    );
    const requests = review.requests.map((request) => ({
        ...request,
        label: labels.get(request.step) ?? request.label,
    }));

    const copied = useCopied();
    const copyFeedback = () => {
        copy(feedbackPrompt(tab.id, tab.label, requests));
        copied.flash();
    };
    const [help, setHelp] = useState(false);
    useKeyboard({
        copy: requests.length > 0 ? copyFeedback : undefined,
        foldAll: () => {
            // The cursor moves up to its goal's header, which stays visible.
            document.activeElement
                ?.closest(".goal")
                ?.querySelector<HTMLElement>('[data-nav="goal"]')
                ?.focus({ preventScroll: true });
            folding.setAll(true);
        },
        unfoldAll: () => folding.setAll(false),
        nextTab: () => onCycleTab(1),
        prevTab: () => onCycleTab(-1),
        help: () => setHelp(!help),
        leave: () =>
            help ? setHelp(false) : host.send({ type: "focusEditor" }),
    });

    if (tab.kind === "error") {
        return (
            <Notice title="This restitution can't be shown" tone="error">
                <ErrorList errors={tab.errors} />
            </Notice>
        );
    }
    const { restitution } = tab;
    const resolved = new Set(review.resolved);
    // Seeing a step sees what is new on it: the step and its answers.
    const byPrint = new Map(
        states.flat().map((state) => [state.fingerprint, state]),
    );
    const seen = (fingerprint: string) =>
        act({
            type: "known",
            steps: [
                fingerprint,
                ...(byPrint.get(fingerprint)?.newAnswers.map(answerKey) ?? []),
            ],
        });
    const flat = states.flat();
    const changedSteps = flat.filter((state) => state.changed).length;
    const newAnswers = flat.reduce(
        (n, state) => n + state.newAnswers.length,
        0,
    );

    return (
        <>
            {restitution.request && (
                <p className="request">{restitution.request}</p>
            )}
            {restitution.goals.length > 1 && (
                <Overview
                    goals={restitution.goals}
                    states={states}
                    onGoto={folding.reveal}
                    uncovered={countChanged(uncovered)}
                    onGotoUncovered={() => {
                        setShowUncovered(true);
                        const section = document.getElementById("uncovered");
                        if (section) {
                            scrollToElement(section);
                        }
                    }}
                />
            )}
            {restitution.goals.map((goal, index) => (
                <GoalSection
                    key={`${index}-${goal.title}`}
                    goal={goal}
                    number={index + 1}
                    steps={states[index] ?? []}
                    diffs={diffs}
                    sources={sources}
                    folded={folding.isFolded(index)}
                    onToggleFold={() => folding.toggle(index)}
                    onViewedChange={(step, on) => {
                        act({ type: "viewed", step, on });
                        if (on) {
                            seen(step);
                        }
                    }}
                    onSeen={seen}
                    onRequestChange={(step, label, clarify, comment) =>
                        act({ type: "request", step, label, clarify, comment })
                    }
                    onOpenRequest={(request) => host.send(request)}
                    onOpenUrl={(url) => host.send({ type: "openUrl", url })}
                    resolved={resolved}
                    onResolve={(answer, on) =>
                        act({ type: "resolve", answer, on })
                    }
                />
            ))}
            <UncoveredSection
                entries={uncovered}
                open={showUncovered}
                onToggle={() => setShowUncovered(!showUncovered)}
                onOpenRequest={(request) => host.send(request)}
            />
            <FeedbackBar
                requests={requests}
                copied={copied.copied}
                onCopy={copyFeedback}
                onReset={() => act({ type: "reset" })}
            />
            <ChangesPill
                steps={changedSteps}
                answers={newAnswers}
                onNext={() => jumpToChange(1)}
            />
            <KeyHelp shown={help} />
        </>
    );
}
