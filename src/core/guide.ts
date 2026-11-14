/**
 * What agents are told. The MCP server sends SERVER_INSTRUCTIONS at startup
 * (clients may put them in the system prompt), returns GUIDE from
 * restitution_guide and FEEDBACK_GUIDE from restitution_feedback.
 */

export const SERVER_INSTRUCTIONS = `Restitution gives the human a short reading guide to the code changes you just made, shown in their editor.
After you finish a code change the user asked for, call restitution_guide once, then restitution_submit with your steps. Skip it for answers that changed no code.
If the user pastes their review of a restitution (steps to clarify, comments), call restitution_feedback with its id first.
It is optional for the user and must never block your work.`;

export const GUIDE = `# Writing a restitution

A restitution is a reading guide for the human who asked for the change. They read it right after your turn, then read the real code in their editor. Teach them the change: what to read, in what order, and why. It never replaces the code.

## How to submit

Call restitution_submit with:
{ id?, label?, request?, goals: [ { title, ref?, steps: [ { file?, lines?, why, link? } ] } ] }

Leave "id" out, except when you update an existing restitution after the user's review (restitution_feedback tells you).

- A step that points at code gives BOTH "file" and "lines" (a "which means" step, which only explains, gives neither).
  - "file" is the path relative to the git root.
  - "lines" is a list of [from, to] ranges: EXACTLY the lines of that file the step shows the reader, nothing more. Use the line numbers of the file as it is now, after your edits.
  - Choose what the reader needs to follow the step: the changed lines and the few lines of unchanged code around them that make them readable. Use several ranges when a step touches separate places, and keep each range as small as it can be.
  - A removed line has no number any more: it sits with the line just before it, so include that line. For a deleted file, use the line numbers it had before.
- Every changed line must be shown by some step. The tool saves your restitution, then lists the changed lines no step shows and the steps whose lines hold no change. Treat that as a hint, not a verdict: fix what is really wrong and submit again.
- The card shows exactly those lines. When the reader opens the step in their editor, the changed lines among them are selected (the unchanged context around them is not), so show enough context to be readable and let the selection point at what changed.
- Your restitution is one tab in the user's panel (label names it, otherwise the request does). Submitting again in this session replaces your tab; other agents' tabs are never touched.
- Submit when the change is complete, and again when the code changes after feedback. Rewrite the story so it matches the current code instead of appending "then I fixed ...".

## Goals

Goals come from the request, in its words. A goal stands on its own: it could be reverted without touching any other goal. So:
- Parts that only make sense together are ONE goal with several steps: a feature with its config, its tests and its docs; a helper with the code that calls it. Two goals that depend on each other are one goal.
- Work you did beyond the request gets its own goal, titled "Unrequested: ...".
- There is no limit on the number of steps in a goal. Use as many as it takes to teach the change.

## Steps: the page reads as one sentence

Each step is a card. Between two cards of the same goal sits one connector word, and the next card's "why" continues after it, so the whole goal reads top to bottom as a single sentence:

  Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text.       <- step 1, no connector
  Which means
  any environment still set to an http:// URL now fails at startup.                       <- step 2, link "which means", no code
  So
  say in the README that the URL must be https, so operators switch before deploying.     <- step 3, link "so"
  Then
  write the test that rejects an http URL, to catch a regression early.                   <- step 4, link "then"

- "why" is ONE sentence of about 15 words or fewer, shaped action then reason: what was done, then why. Never "Before it did X, now it does Y". A "which means" step states a consequence instead, in one or two short sentences.
- The first step of a goal starts the sentence: capitalised, imperative ("Require https ...").
- Every other step continues after its connector: start with a lowercase verb ("write the test ...") unless it begins with a name ("GatewayClient now ..."). Read the goal aloud, connector words included. If it does not sound like a normal sentence, rewrite it.
- No background and no "what to check": the reader knows the codebase and the request. Leave out dead ends and your own history.

## Connectors (the "link" field)

"link" says how this step follows the previous step of the same goal. Leave it out on the first step of a goal. Leave it out anywhere else and the connector is "then".

- "then" (the default). This step builds on the previous one: stop right before it and the code still works, it is just not finished (the helper exists and nothing uses it yet, the tests are not written). Use it when in doubt.
  Reads as: "Then / write the unit tests to cover what was added."
- "in parallel". Leave this step out entirely and no other step would notice: the reader could read it before or after the previous one.
  Reads as: "In parallel / update the README row for the new setting."
- "which means". This step changes no code: it says what the previous step implies, that the reader must know. Behaviour that changes for users, operators or callers; something that now has to happen, in the code or outside it. Give it no file and no lines.
  Reads as: "Which means / any environment still set to an http:// URL now fails at startup."
- "so". ONLY right after a "which means" step (the tool rejects it anywhere else): this step is the code that deals with the consequence just stated.
  Reads as: "Which means / every caller must now pass a timeout. So / update the three callers."

A change that forces another (a new parameter, so the callers change) is worth saying out loud: put the consequence in a "which means" step and the forced change after "so". The reader then knows why that code changed, not just that it did. A consequence that needs no code is followed by "then", or ends the goal.

Goals have no connectors between them: they are independent.

## Teaching well

Teach it the way you would to a colleague who has not seen the change: foundations first, then what builds on them, then proof (tests) and docs. Explain as much as the user asked for: if they want more or less detail, give more or fewer steps and longer or shorter sentences. Do not narrate the code line by line; say what to look at and why it is there.

## Example

{
  "request": "Retry transient gateway failures",
  "goals": [
    {
      "title": "Retry transient gateway failures",
      "steps": [
        { "file": "src/errors.ts", "lines": [[11, 23]], "why": "Add a GatewayError that carries the upstream status, so callers can tell a 5xx from a 4xx." },
        { "file": "src/gateway/retry.ts", "lines": [[1, 35]], "link": "then", "why": "build withRetry on top of it, retrying only 5xx responses with exponential backoff." },
        { "file": "src/gateway/client.ts", "lines": [[1, 10], [15, 38]], "link": "then", "why": "run json() through withRetry, so every JSON call benefits." },
        { "link": "which means", "why": "a call that fails with a 5xx now takes up to 7 seconds before the error reaches the caller." },
        { "file": "src/server.ts", "lines": [[40, 44]], "link": "so", "why": "raise the request timeout to 10 seconds, so the retries can finish." },
        { "file": "test/retry.test.ts", "lines": [[1, 57]], "link": "then", "why": "write the unit tests to cover what was added." },
        { "file": "README.md", "lines": [[15, 26]], "link": "then", "why": "describe the retry behaviour, so operators know what to expect." }
      ]
    }
  ]
}
`;

export const FEEDBACK_GUIDE = `# Handling the user's review

The user read the restitution below and pasted their review: a list of steps by label ("3.1"), each with "clarify", a comment in quotes, or both. Labels refer to the restitution as it is below.

- "clarify": the user did not follow that step at its current grain. Replace it with several smaller steps, in the same place in the same goal, split by change: each smaller step shows only the lines of its own change (with a little context), says what that change does and why, and continues the sentence after a connector word. The first of them keeps the original step's connector.
- A comment: the user's question or request about that step. Answer questions in your reply. If it asks for a change to the code, make the change, then make the step (or new steps) match it.

Then:
1. Keep every step you did not touch exactly as it was, word for word: unchanged steps stay read for the user, while any step you change or add is shown to them as updated.
2. Call restitution_submit with the whole restitution and "id" set to the id below, so the same tab is updated instead of a new one appearing.
3. In your reply, answer the comments that were questions, briefly.
`;
