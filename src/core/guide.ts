/**
 * What agents are told. The MCP server sends SERVER_INSTRUCTIONS at startup
 * (clients may put them in the system prompt) and returns GUIDE from
 * restitution_guide.
 */

export const SERVER_INSTRUCTIONS = `Restitution gives the human a short reading guide to the code changes you just made, shown in their editor.
After you finish a code change the user asked for, call restitution_guide once, then restitution_submit with your steps. Skip it for answers that changed no code.
It is optional for the user and must never block your work.`;

export const GUIDE = `# Writing a restitution

A restitution is a reading guide for the human who asked for the change. They read it right after your turn, then read the real code in their editor. Teach them the change: what to read, in what order, and why. It never replaces the code.

## How to submit

Call restitution_submit with:
{ label?, request?, goals: [ { title, ref?, steps: [ { file?, lines?, why, link? } ] } ] }

- file: path relative to the git root. lines: [from, to] on the new side, only to pick one part of a big file.
- The tool saves it, then tells you which changed code no step explains and which steps point at unchanged code. Treat that as a hint, not a verdict: fix what is really wrong and submit again.
- Your restitution is one tab in the user's panel (label names it, otherwise the request does). Submitting again in this session replaces your tab; other agents' tabs are never touched.
- Submit when the change is complete, and again when the code changes after feedback. Rewrite the story so it matches the current code instead of appending "then I fixed ...".

## Goals

Goals come from the request, in its words. A goal stands on its own: it could be reverted without touching any other goal. So:
- Parts that only make sense together are ONE goal with several steps: a feature with its config, its tests and its docs; a helper with the code that calls it. Two goals that depend on each other are one goal.
- Work you did beyond the request gets its own goal, titled "Unrequested: ...".
- There is no limit on the number of steps in a goal. Use as many as it takes to teach the change.

## Steps: the page reads as one sentence

Each step is a card. Between two cards of the same goal sits one connector word, and the next card's "why" continues after it, so the whole goal reads top to bottom as a single sentence:

  Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text.     <- step 1, no connector
  Then
  write the test that rejects an http URL, to catch a regression early.                 <- step 2, link "then"
  Finally
  note in the README that the URL must be https, so operators know before deploying.    <- step 3, link "finally"

- "why" is ONE sentence of about 15 words or fewer, shaped action then reason: what was done, then why. Never "Before it did X, now it does Y".
- The first step of a goal starts the sentence: capitalised, imperative ("Require https ...").
- Every other step continues after its connector: start with a lowercase verb ("write the test ...") unless it begins with a name ("GatewayClient now ..."). Read the goal aloud, connector words included. If it does not sound like a normal sentence, rewrite it.
- No background and no "what to check": the reader knows the codebase and the request. Leave out dead ends and your own history.

## Connectors (the "link" field)

"link" says how this step follows the previous step of the same goal. Leave it out on the first step of a goal. Leave it out anywhere else and the connector is "then".

- "then" (the default). This step comes after the previous one and builds on it, but does not have to follow from it. Use it when in doubt.
  Reads as: "Then / write the unit tests to cover what was added."
- "so". The previous step forces this one: it changed something (a signature, a type, a schema, an error class) and this step exists because of that.
  Reads as: "So / update the call sites to the new signature."
- "in parallel". This step and the previous one do not depend on each other: the reader could read them in either order. Use it only when nothing in this step needs the previous one (it does not import from it, call it or test it).
  Reads as: "In parallel / update the README row for the new setting."
- "finally". The last step of the goal, wrapping up what the steps before built: docs, cleanup, a last check. Only on the final step.
  Reads as: "Finally / document the new setting in the README."

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
        { "file": "src/errors.ts", "why": "Add a GatewayError that carries the upstream status, so callers can tell a 5xx from a 4xx." },
        { "file": "src/gateway/retry.ts", "link": "so", "why": "build withRetry on top of it, retrying only 5xx responses with exponential backoff." },
        { "file": "src/gateway/client.ts", "link": "then", "why": "run json() through withRetry, so every JSON call benefits." },
        { "file": "test/retry.test.ts", "link": "then", "why": "write the unit tests to cover what was added." },
        { "file": "README.md", "link": "finally", "why": "describe the retry behaviour, so operators know what to expect." }
      ]
    }
  ]
}
`;
