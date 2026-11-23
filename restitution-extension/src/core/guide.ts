/**
 * What agents are told. The MCP server sends SERVER_INSTRUCTIONS at startup
 * (clients may put them in the system prompt), returns GUIDE from
 * restitution_guide and FEEDBACK_GUIDE from restitution_feedback.
 */

export const SERVER_INSTRUCTIONS = `Restitution gives the human a short reading guide to the code changes you just made, shown in their editor.
After you finish a code change the user asked for, call restitution_guide once, then restitution_submit with your steps. Use it too when the user asks you to explain existing code: point the steps at that code. Skip it for other answers.
To change part of it later, call restitution_edit instead of resubmitting it whole. A second, different restitution in the same session is another tab (newTab); restitution_list shows every tab with its id.
If the user pastes their review of a restitution (steps to clarify, comments), call restitution_feedback with its id first.
It is optional for the user and must never block your work.`;

export const GUIDE = `# Writing a restitution

A restitution is a reading guide for the human who asked for the change. They read it right after your turn, then read the real code in their editor. Teach them the change: what to read, in what order, and why. It never replaces the code.

## How to submit

Call restitution_submit with:
{ id?, newTab?, label?, request?, note?, goals: [ { title, ref?, steps: [ { file?, lines?, why, link?, examples?: [ { title, body } ], docs?: [ { title, url } ] } ] } ] }

Leave "id" and "note" out, except when you update an existing restitution after the user's review (restitution_feedback tells you). "note" is then one or two sentences on what you changed and why.

- A step that points at code gives BOTH "file" and "lines" (a "which means" step, which only explains, gives neither).
  - "file" is the path relative to the git root.
  - "lines" is a list of [from, to] ranges: EXACTLY the lines of that file the step shows the reader, nothing more. Use the line numbers of the file as it is now, after your edits.
  - Choose what the reader needs to follow the step: the changed lines and the few lines of unchanged code around them that make them readable. Use several ranges when a step touches separate places, and keep each range as small as it can be.
  - The card shows the ranges in the order you list them, each as its own block. When a step introduces a function (or any new definition), list where it is used first, then the definition: the reader sees why it exists before how it works. When it is used in another file, that use is the step just before.
  - A removed line has no number any more: it sits with the line just before it, so include that line. For a deleted file, use the line numbers it had before.
- A step can also point at code that did not change: existing code the change relies on, or that the reader must see to follow it. The card shows those lines as they are now, labelled "Unchanged code". Mix both freely: put a step on existing code in the middle of a goal, right where the reader needs it (the function a new call goes through, the type a change must fit).
- When the user's request is to explain existing code (not a change of yours), the restitution IS the explanation: goals come from what they asked to understand, in their words, like any request, and steps walk through the code in the order it runs. The changed-lines report doesn't apply then. This is about their request only: a review of your restitution is handled with restitution_feedback, never by restructuring.
- Every changed line must be shown by some step. The tool saves your restitution, then lists the changed lines no step shows and the steps whose lines hold no change. Treat that as a hint, not a verdict: fix what is really wrong with restitution_edit.
- The card shows exactly those lines. When the reader opens the step in their editor, the changed lines among them are selected (the unchanged context around them is not), so show enough context to be readable and let the selection point at what changed.
- Your restitution is one tab in the user's panel (label names it, otherwise the request does). Submitting again replaces your current tab, which is right when it is the same work. For a different restitution in the same session, submit with "newTab": true: it opens another tab, becomes your current one, and the earlier tab stays. The reply gives the tab's id; restitution_list shows all of them, yours marked. Other agents' tabs are never touched: work on a tab that is not your current one (give its id to restitution_submit, restitution_edit or restitution_answer) only when the user's review names it or they ask.
- Submit when the change is complete. When the code or the guide changes afterwards, fix only the steps concerned with restitution_edit (below). Make the story match the current code instead of appending "then I fixed ...".

## Changing it: restitution_edit

restitution_edit changes part of your restitution and leaves every other step exactly as it was, so the user keeps what they already read. It takes a list of edits, applied together; labels ("2.1") and goal numbers refer to the restitution as it was before these edits:
- { "op": "set", "step": "2.1", "fields": { "why": "...", "lines": [[12, 20]] } }: change some fields of a step.
- { "op": "replace", "step": "2.1", "steps": [ ... ] }: several steps to split it, one to rewrite it, none to remove it.
- { "op": "insert", "after": "2.1", "steps": [ ... ] } (or "before"): add steps.
- { "op": "setGoal", "goal": 2, "title": "..." }, { "op": "removeGoal", "goal": 2 }, { "op": "addGoal", "goal": { ... }, "after": 1 }.
Give "note" too: one or two sentences for the user on what you changed in this update and why. It heads the list of updates at the top of their panel. If any edit is wrong, nothing is changed and the reply says why. The reply also lists the steps with their new labels. Resubmit the whole restitution only when most of it changes.

## Goals

Goals come from the request, in its words. A goal stands on its own: it could be reverted without touching any other goal. So:
- Parts that only make sense together are ONE goal with several steps: a feature with its config, its tests (each right after the code it proves) and its docs; a helper with the code that calls it. Two goals that depend on each other are one goal.
- Work you did beyond the request gets its own goal, titled "Unrequested: ...".
- There is no limit on the number of steps in a goal. Use as many as it takes to teach the change.

## Steps: the page reads as one sentence

Each step is a card. Between two cards of the same goal sits a connector (a word or a few), and the next card's "why" continues after it, so the whole goal reads top to bottom as a single sentence:

  <Action>, so <reason>.                    <- first step: no connector
  <Connector>
  <next action>, so <reason>.               <- continues the sentence
  <Connector>
  <what that implies for the reader>.       <- a step without code

- "why" is ONE sentence of about 15 words or fewer, shaped action then reason: what was done, then why. Never "Before it did X, now it does Y". A step without code (a consequence, a caveat) says it in one or two short sentences instead.
- The first step of a goal starts the sentence: capitalised, imperative.
- Every other step continues after its connector: it starts with a lowercase verb, unless it begins with a name. Read the goal aloud, connector words included. If it does not sound like a normal sentence, rewrite it.
- No background and no "what to check": the reader knows the codebase and the request. Leave out dead ends and your own history.

## Connectors (the "link" field)

"link" is the connector shown before this step: the few words that carry the sentence from the previous card into this one. Leave it out on the first step of a goal and give it on every other step. Choose freely the words that make the two cards read as ONE natural sentence; there is no fixed list. Write it, like everything else, in the language the user writes to you in.

Suggestions, for common cases:
- "then": this step builds on the previous one (stop before it and the code still works, it is just not finished). The default.
- "in parallel": this step is independent of the previous one; it could be read before it.
- "which means": this step changes no code and states what the previous step implies, that the reader must know (behaviour that changes for users, operators or callers; something that now has to happen). Give it no file and no lines.
- "so": right after such a consequence, the code that deals with it.
- Anything else that fits: "because", "although", "and since", "to do that", "but", "for example", "which is why", "after that".

Test every link: read the end of the previous card, the link, then this card, aloud. If it does not sound like a sentence someone would say, change the link or reword the step. A caveat, for instance, reads after "although", not after "which means".

A change that forces another is worth saying out loud: state the consequence in its own step, then the forced change after it. The reader then knows why that code changed, not just that it did.

Goals have no connectors between them: they are independent.

## Examples (the "examples" field)

An example is anything concrete that helps the reader understand a step, or get their hands on it, and that the diff does not show. It is shown as monospace text, so it can be data, code or a command. Two kinds matter most:

- data from outside, which the reader cannot see anywhere else: what an external system sends or receives, a file format, an environment value;
- anything that saves the reader friction in trying the change themselves: the command to run or try it, the request to send to the new endpoint, the config entry that turns the feature on, the command that runs its tests, how to call the new function from outside.

What it produces (CLI output, a log line, the response of the new endpoint) is worth showing too. Be generous with examples that save the reader a search or a guess; do not copy code the diff already shows.

- Put the example on the step it illustrates: the parser of the payload, the schema it is validated against, the function it shows how to call. Its place must make obvious what the example is.
- "title" is a natural phrase, in the user's language, saying what the example is and where it comes from, so it makes sense on its own ("What <the system> sends when <event>", "The command to try it"). Not a bare label.
- "body" is the example itself, verbatim and realistic but short: cut long lists to one or two items with "…", and replace secrets, tokens and personal data with obvious placeholders.
- The reader sees the title, folded, between the "why" and the code, and opens it on click.

## Documentation references (the "docs" field)

When a step relies on something specific about how a library, an API, a protocol or a tool behaves, something the reader may not know and the code depends on, point them to the exact place in its documentation where they can read it for themselves. They see the link right under the step's "why", and it opens in their browser.

- Put it on the step whose code relies on that behaviour.
- "title" is a natural phrase, in the user's language, saying what they will learn there and where ("How <the behaviour the code relies on> (<source>)"). Not a bare page name.
- "url" goes straight to the section: the page and its anchor, never the site's home page. Prefer the official documentation. Only give an address you are sure exists; if you are unsure of the anchor, link the page.
- Use it for behaviour worth checking, not for every library call.

## Teaching well

Teach it the way you would to a colleague who has not seen the change: foundations first, then what builds on them, and docs last.

Tests go with the code they prove: put the step on a test right after the step on the code it checks, in the same goal, so the reader sees the behaviour and its proof together. Never gather the tests at the end of a goal, or in a goal of their own. Explain as much as the user asked for: if they want more or less detail, give more or fewer steps and longer or shorter sentences. Do not narrate the code line by line; say what to look at and why it is there.

## Example

The shape only: write your own words, about your own change.

{
  "request": "<the user's request>",
  "goals": [
    {
      "title": "<a goal, in the request's words>",
      "steps": [
        { "file": "src/a.ts", "lines": [[10, 24]], "why": "<Action>, so <reason>." },
        { "file": "src/b.ts", "lines": [[3, 3], [40, 46]], "link": "then", "why": "<next action>, so <reason>.",
          "examples": [ { "title": "<what it is and where it comes from>", "body": "<verbatim, short>" } ],
          "docs": [ { "title": "<what the reader learns there> (<source>)", "url": "https://docs.example.com/page#section" } ] },
        { "link": "which means", "why": "<what this implies for the reader>." }
      ]
    }
  ]
}
`;

export const FEEDBACK_GUIDE = `# Handling the user's review

The user read the restitution below and pasted their review: a list of steps by label ("3.1"), each with "clarify", a comment in quotes, or both. Labels refer to the restitution as it is below.

- "clarify": the user did not follow that step at its current grain. Replace it with several smaller steps, in the same place in the same goal, split by change: each smaller step shows only the lines of its own change (with a little context), says what that change does and why, and continues the sentence after a connector word. The first of them keeps the original step's connector.
- A comment: the user's question or request about that step. If it asks for a change to the code, make the change, then make the step (or new steps) match it. It may follow up one of your earlier answers on that step (listed at the end): answer it in that light, without repeating yourself.

Comments are not a new outline: never add goals for them or reorganise the restitution around them. Each one gets an answer, and changes only the step it is about (when it asks for a change).

Then:
1. Change only what the review is about: any step you change or add is shown to the user as updated, so leave the others alone.
2. Call restitution_edit with "id" set to the id below, and a "note" saying what you changed and why: "replace" each clarified step with its smaller steps, and "set" or "replace" the steps a comment made you change. Steps you do not mention stay as they were, and stay read for the user.
3. Answer EVERY comment with restitution_answer (same "id"): the user's comment word for word, the label of the step it is about as it is after your edits, and your answer. A question gets its answer; a change request gets what you changed and where. It shows under their comment in the panel, so they never lose track of it. Your chat reply then only needs a one-line summary.
`;
