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

Call restitution_submit (its schema has the shape; the example at the end shows it filled in). Leave "id" and "note" out, except when you update an existing restitution after the user's review (restitution_feedback tells you). "note" is then one or two sentences on what you changed and why.

- A step that points at code gives "code": the places it shows, in reading order, each { "file", "lines" } (a "which means" step, which only explains, gives none).
  - "file" is the path relative to the git root.
  - "lines" is a list of [from, to] ranges: EXACTLY the lines of that file the step shows the reader, nothing more, numbered as the file is now, after your edits. Choose what the reader needs to follow the step: the changed lines and the few lines of unchanged code around them that make them readable, in several ranges when a step touches separate places, each as small as it can be. When the reader opens the step in their editor, only the changed lines among them are selected, so the context stays unselected and the selection points at what changed.
  - The card shows the places in the order you list them, and the ranges of a place in their order, each as its own block. Places can be in different files, and a file can come back later in the list. So one step can follow one idea across files: a new definition, then where it is used.
  - A removed line has no number any more: it sits with the line just before it, so include that line. For a deleted file, use the line numbers it had before.
- A step can also point at code that did not change: existing code the change relies on, or that the reader must see to follow it. The card shows those lines as they are now, labelled "Unchanged code". Mix both freely: put a step on existing code in the middle of a goal, just before the step that needs it (the function a new call goes through, the type a change must fit).
- When the user's request is to explain existing code (not a change of yours), the restitution IS the explanation: goals come from what they asked to understand, in their words, like any request, and steps follow the same order as any restitution (see "Order"). The changed-lines report doesn't apply then. This is about their request only: a review of your restitution is handled with restitution_feedback, never by restructuring.
- Every changed line must be shown by some step. The tool saves your restitution, then lists the changed lines no step shows and the places whose lines hold no change. Treat that as a hint, not a verdict: fix what is really wrong with restitution_edit.
- Your restitution is one tab in the user's panel (label names it, otherwise the request does). Submitting again replaces your current tab, which is right when it is the same work; for a different restitution in the same session, submit with "newTab": true. Work on a tab that is not your current one (give its id; restitution_list shows them all) only when the user's review names it or they ask.
- Submit when the change is complete. Afterwards fix only the steps concerned, with restitution_edit, and make the story match the current code instead of appending "then I fixed ...".

## Changing it: restitution_edit

restitution_edit changes part of your restitution and leaves every other step exactly as it was, so the user keeps what they already read. Its schema has the ops (set, replace, insert, setGoal, removeGoal, addGoal). The edits apply together, and labels ("2.1") and goal numbers refer to the restitution as it was before them. Give "note" too: one or two sentences for the user on what you changed in this update and why, shown at the top of their panel. If any edit is wrong, nothing is changed and the reply says why. Resubmit the whole restitution only when most of it changes.

## Order: nothing is used before it is defined

The reader builds their picture of the change card by card. Every name, type, function, file, config key or concept a card mentions must already be known to them: an earlier card showed it, or it is ordinary vocabulary of their domain or of the code as it was before your change. Never send them forward to find out what something is. If existing code they need is not obvious, show it in a step on unchanged code before it is needed.

So order everything, goals and steps alike, by what depends on what: start with what depends on nothing and end with what depends on everything. That means the callee before the caller, the definition before its use, shared building blocks before what uses them, and a contract before the code that implements it or calls it. Whatever assembles the rest (wiring, configuration, packaging, deployment) comes after what it assembles. Work the order out from what references what in your change, not from an assumed architecture.
- A card may show a definition and its use together, definition first.
- A test comes right after the code it proves, in the same goal, never gathered at the end or in a goal of its own, so the reader sees behaviour and proof together. Any helper or fake it needs was shown by an earlier card.
- A step that states a consequence comes after the code that causes it and before the code that deals with it.
- A title or "why" uses only terms the reader already knows. If it needs a name that a later card defines, move that card earlier or reword.

Before submitting, walk the cards in order, keeping track of what the reader knows so far. Check every name each card's title, "why", examples and code mention. If one is not known yet, reorder or reword.

## Goals

Goals come from the request, in its words, using the exact names the code uses: titles and "why"s are what the reader remembers the change by. A goal is one part of the change the reader can name: a feature with its config, its tests and its docs; a building block with what it defines.
- Goals may depend on each other. Order them by the rule above: a goal can use what an earlier goal defined, never what a later one defines.
- Work you did beyond the request gets its own goal, titled "Unrequested: ...", placed where the order puts it.
- There is no limit on the number of steps in a goal. Use as many as it takes to teach the change.

## Steps: the page reads as one sentence

Each step is a card. Between two cards of the same goal sits a connector (a word or a few), and the next card's "why" continues after it, so the whole goal reads top to bottom as a single sentence:

  <Action>, so <reason>.                    <- first step: no connector
  <Connector>
  <next action>, so <reason>.               <- continues the sentence
  <Connector>
  <what that implies for the reader>.       <- a step without code

- "why" is ONE sentence of about 15 words or fewer, shaped action then reason: what was done, then why. Never "Before it did X, now it does Y". A step without code (a consequence, a caveat) says it in one or two short sentences instead.
- When a card introduces a named construct (a class, function, interface, type, module, config key…), its "why" names it and says what kind of thing it is, then what it does, then why: "<Add> a <Name> <kind> that <does what>, so <reason>", not only "<Do what>, so <reason>". The reader then knows the name when later cards use it.
- The first step of a goal starts the sentence: capitalised, imperative.
- Every other step continues after its connector: it starts with a lowercase verb, unless it begins with a name. Read the goal aloud, connector words included. If it does not sound like a normal sentence, change the connector or reword the step.
- No background, recap or "what to check": the reader knows the codebase and the request, and the order and exact names do the rest. Leave out dead ends and your own history.

## Connectors (the "link" field)

"link" is the connector shown before this step: the few words that carry the sentence from the previous card into this one. Leave it out on the first step of a goal and give it on every other step. Choose freely the words that make the two cards read as ONE natural sentence; there is no fixed list. Write it, like everything else, in the language the user writes to you in.

Common cases:
- "then": this step builds on the previous one (stop before it and the code still works, it is just not finished). The default.
- "in parallel": this step is independent of the previous one; it could be read before it.
- "which means": this step changes no code and states what the previous step implies, that the reader must know (behaviour that changes for users, operators or callers; something that now has to happen). Give it no code.
- "so": right after such a consequence, the code that deals with it. A change that forces another is said this way, so the reader knows why that code changed, not just that it did.
- Anything else that fits: "because", "although" (a caveat reads after it, not after "which means"), "and since", "to do that", "but", "for example", "which is why", "after that".

Goals have no connectors between them: each goal starts a new sentence.

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

Teach it the way you would to a colleague who has not seen the change, in the order above.

Explain as much as the user asked for: if they want more or less detail, give more or fewer steps and longer or shorter sentences. Do not narrate the code line by line; say what to look at and why it is there.

## Example

The shape only: write your own words, about your own change.

{
  "request": "<the user's request>",
  "goals": [
    {
      "title": "<a goal, in the request's words>",
      "steps": [
        { "code": [ { "file": "src/a.ts", "lines": [[10, 24]] } ], "why": "<Action>, so <reason>." },
        { "code": [ { "file": "src/b.ts", "lines": [[40, 46]] }, { "file": "src/c.ts", "lines": [[3, 9]] } ], "link": "then", "why": "<next action>, so <reason>.",
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

- "clarify": the user did not follow that step at its current grain. Replace it with several smaller steps, in the same place in the same goal, split by change and ordered so nothing is used before it is defined: each smaller step shows only the lines of its own change (with a little context), says what that change does and why, and continues the sentence after a connector word. The first of them keeps the original step's connector.
- A comment: the user's question or request about that step. If it asks for a change to the code, make the change, then make the step (or new steps) match it. It may follow up one of your earlier answers on that step (listed at the end): answer it in that light, without repeating yourself.

Comments are not a new outline: never add goals for them or reorganise the restitution around them. Each one gets an answer, and changes only the step it is about (when it asks for a change).

Then:
1. Change only what the review is about: any step you change or add is shown to the user as updated, so leave the others alone.
2. Call restitution_edit with "id" set to the id below, and a "note" saying what you changed and why: "replace" each clarified step with its smaller steps, and "set" or "replace" the steps a comment made you change. Steps you do not mention stay as they were, and stay read for the user.
3. Answer EVERY comment with restitution_answer (same "id"): the user's comment word for word, the label of the step it is about as it is after your edits, and your answer. A question gets its answer; a change request gets what you changed and where. It shows under their comment in the panel, so they never lose track of it. Your chat reply then only needs a one-line summary.
`;
