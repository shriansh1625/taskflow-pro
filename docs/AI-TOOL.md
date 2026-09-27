# AI-Tool Declaration

Point the portal's AI-Tool field at this file. The model is used in two places, and in both places the engine stays in charge of dates, columns, and edges.

## In the product

- Feature: dependency suggestion, plus a one-paragraph explanation of a derived finish. The model does not set dates, columns, or readiness.
- Explanation: the server builds a fact sheet from the engine. Held-by is the task that sets the date. Blocked-by is the unmet list. They are different sentences. Groq may rewrite that sheet in exactly three sentences. The server folds unicode dashes into ordinary hyphens, then keeps the rewrite only if every date is in the sheet, the held-by name matches, and the blocked-by names are not added to. "Held and blocked" is discarded. The fact sheet is shown instead.
- Provider: Groq OpenAI-compatible chat API.
- Model: `openai/gpt-oss-120b` at temperature 0.
- Output: a JSON object `{ "proposals": [ { predecessorId, successorId, reason, confidence } ] }`.
- Grounding: the prompt receives a closed catalog of stored task ids, titles, descriptions, columns, planned starts, durations, and existing edges. Derived dates are not sent. Titles are labeled untrusted data, not instructions.
- Server filter: drop unknown ids, self-links, duplicates, existing edges, and anything the cycle checker would reject. Dropped rows are returned with a reason and shown in the panel.
- Ranking: remaining proposals are ordered by days the engine would move, then whether the edge would bind, then confidence. The panel lists the finishes that would move.
- Human loop: Accept calls `POST /api/dependencies`. Dismiss writes nothing.
- Fallback: if the key is missing, Groq times out, or JSON is unusable, a labeled heuristic still goes through the same filter and accept step. Browser-visible errors are sanitized; provider response bodies are not forwarded.
- The Groq key stays in server environment variables (`.env`, gitignored) and is never sent to the browser.
- Suggestion and explanation limits are stored per board in the database.

## In the build process

- Cursor was used as a coding assistant for the board, tests, and this declaration.
- Scheduling code is kept only while `npm test` stays green (cycle, diamond, chain, regression, suggestion grounding).
