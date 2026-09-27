# Test suite

Run from a clone:

```bash
npm test
npm run typecheck
```

Last local run: 6 files, 52 tests, all passed. GitHub Actions on `main` runs the same two commands on Ubuntu with Node 22: https://github.com/shriansh1625/taskflow-pro/actions/workflows/test.yml

The suite uses a temporary SQLite file created for the test run. It does not call Groq and it does not click the live site.

## `tests/engine.test.ts` (21)

Schedule rules with no database.

- Crosses a month boundary in UTC.
- Rejects a zero duration before any write.
- Rejects a self link.
- Rejects a cycle and names the path without changing the stored edges.
- Rejects a two-node loop.
- Moves the diamond by 3 days, not 6.
- Moves a chain by 3 days, not 6.
- Does not move a task when the slipped predecessor is not binding.
- Drops a delay when the edge that caused it is removed.
- Adds a second slip on top of planned inputs, not on a stored delay.
- Blocks a done successor when an upstream task leaves Done.
- Clears the chain when the upstream task returns to Done.
- Refuses a forward move while blocked and allows a move backward.
- Reports zero days when the new edge does not bind.
- Ranks a binding edge by the days it moves.
- Seed has 9 tasks and a diamond that moves 3 days.
- Does not rewrite planned start when a predecessor slips.
- Rejects an impossible calendar date before scheduling.
- Schedules an empty board.
- Refuses to schedule a stored cycle.
- Binds the lexicographically smaller predecessor on a finish tie.

## `tests/board-store.test.ts` (14)

The same rules after a real write, plus isolation.

- Returns 9 seeded tasks with derived fields.
- Rejects a cycle inside the dependency transaction.
- Refuses a forward move while blocked.
- Previews a cycle without writing an edge.
- Rejects an invalid duration instead of poisoning the board.
- Resets to the original seed after a schedule edit.
- Persists a duration change and recomputes the diamond once.
- Rejects a self link and a duplicate without writing.
- Drops a persisted delay when the causing edge is removed.
- Runs the judge walkthrough without compounding the diamond.
- Deletes a task and its edges, then recomputes.
- Reseeds an empty database so a fresh host is usable.
- Keeps one browser's reset off another browser's board.
- Stores write limits in the database and caps new boards per network.

## `tests/suggest.test.ts` (7)

- Drops unknown ids, self links, existing edges, and cycles.
- Sorts survivors by days moved, not confidence.
- Never writes; heuristics skip edges that already exist.
- Prompt only includes catalog ids.
- Catalog sends stored dates, not derived finishes.
- Never forwards provider error bodies to the browser.
- Parses fenced JSON and ignores surrounding text.

## `tests/explain.test.ts` (2)

- States binding, readiness, and that planned dates stay stored. Seed slip is 6 days; schema +3 makes that gap 8 because the stored plan's own latest finish also moves.
- Rejects a rewrite that invents a chain, a date, a unicode-hyphen date, a merged "held and blocked", or the wrong held-by name.

## `tests/http.test.ts` (4)

- Returns BoardError status and path.
- Maps SyntaxError to 400 instead of 500.
- jsonFail is a 400 by default.
- readJson rejects empty and invalid bodies.

## `tests/architecture.test.ts` (4)

- Keeps the engine free of IO, React, and Prisma.
- Keeps React components off the database.
- Keeps the server off React components.
- Derives the Postgres schema from the SQLite models.

## What this suite does not do

It does not open a browser, drag a card, or call the live Groq key. Those paths were exercised by hand against https://taskflow-pro-mauve-one.vercel.app/ during the build: Schema +3d moved Integration tests by 3 days and a second click did not, a forward move of Integration tests returned 409, Regress schema left Backend API in progress and Blocked, and a second browser still had schema duration 4 after the first browser set it to 9.
