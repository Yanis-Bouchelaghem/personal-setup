/**
 * What agents are told. The MCP server sends INSTRUCTIONS at startup (clients
 * may put them in the system prompt) and returns GUIDE from restitution_guide.
 */

export const SERVER_INSTRUCTIONS = `Restitution gives the human a short reading guide to the code changes you just made, shown in their editor.
After you finish a code change the user asked for, call restitution_guide once, then restitution_submit with your steps. Skip it for answers that changed no code.
It is optional for the user and must never block your work.`;

export const GUIDE = `# Writing a restitution

A restitution is a reading guide for the human who asked for the change. They read it right after your turn, then read the real code in their editor. Tell them what to read, in what order, and why. It never replaces the code.

## How to submit

Call restitution_submit with: { label?, request?, goals: [{ title, ref?, steps: [{ file?, lines?, why, because? }] }] }.
- file: path relative to the git root. lines: [from, to] on the new side, only to pick one hunk of a big file.
- The tool saves it, then tells you which changed code no step explains, and which steps point at unchanged code. Fix those and submit again. Your restitution is one tab in the user's panel (label names it, otherwise the request does). Submitting again in this session replaces your tab; other agents' tabs are never touched.
- Submit after the change is complete, and again whenever the code changes after feedback. Rewrite the story so it matches the current code instead of appending "then I fixed ...".

## Rules

1. Goals come from the request, in its words. Six fixes asked means six goals. Work you did beyond the request gets its own goal, titled "Unrequested: ...".
2. Goals are independent changesets: one can be read, reviewed and reverted without the others.
3. Order steps the way a competent engineer would have worked: usually the change that forces the others first, the fix before its test. Default to one step per goal, at most three.
4. A test goes in the same step as the code it proves, never in a separate goal.
5. "why" is ONE sentence, at most 15 words, shaped action then reason: what was done, then why. Good: "Set Authorization through Headers, because a plain object kept both casings." Bad: "Before it built a plain object, now it uses Headers."
6. "because" is optional: add it only when a reader would otherwise wonder why this step exists or why it comes next (for example "Needs the looser schema first."). Independent steps get none.
7. No background and no "what to check". The reader knows the codebase and the request.
8. Write the ideal path, not your history. Leave out dead ends.

## Example

{
  "request": "Fix the review findings",
  "goals": [
    {
      "title": "Reject plain-http Apigee URLs",
      "steps": [
        { "file": "src/config.ts", "why": "Require https for ADAPTER_APIGEE_URL, so bearer tokens never leave in clear text." },
        { "file": "test/config.test.ts", "why": "Pin the startup failure for http URLs, to catch a regression early." }
      ]
    }
  ]
}
`;
