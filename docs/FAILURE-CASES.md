# Known failure cases

These are inputs the system is supposed to refuse. A refusal here is a pass. Each row names the test that locks it.

## Schedule and graph

| Input | Result | Test |
| --- | --- | --- |
| Duration 0 | Rejected before write | `tests/engine.test.ts` rejects a zero duration |
| Impossible calendar date | Rejected before scheduling | `tests/engine.test.ts` rejects an impossible calendar date |
| Task depends on itself | Rejected, nothing stored | `tests/engine.test.ts` and `tests/board-store.test.ts` |
| A → B → C, then C → A | Path named, edge list unchanged | `tests/engine.test.ts` |
| Two-node loop | Rejected | `tests/engine.test.ts` |
| Stored cycle already in the edge list | Board is not scheduled | `tests/engine.test.ts` refuses to schedule a stored cycle |
| Duplicate edge | Rejected, nothing stored | `tests/board-store.test.ts` |
| Preview of a cycle | `ok: false`, no insert | `tests/board-store.test.ts` |
| Blocked card dragged to a later column | 409, column unchanged | `tests/engine.test.ts` and `tests/board-store.test.ts` |
| Invalid duration on a saved task | 400, board unchanged | `tests/board-store.test.ts` |

Live check of the same three judge cases, on a separate browser cookie: Schema +3d moved Integration tests by 3 days and a second write added 0; dragging Integration tests forward returned `BLOCKED` with Backend API and Data migration; Integration tests → Database schema returned `CYCLE` and the edge count stayed 11.

## Rollback and dates

| Input | Result | Test |
| --- | --- | --- |
| Done successor, predecessor leaves Done | Successor stays in Done and becomes Blocked | `tests/engine.test.ts` |
| Predecessor returns to Done | Blocked flag clears | `tests/engine.test.ts` |
| Predecessor slip | Planned start is not rewritten | `tests/engine.test.ts` |
| Edge that caused a delay is removed | Derived delay drops, including after a persisted write | `tests/engine.test.ts` and `tests/board-store.test.ts` |
| Second slip | Applied to planned inputs, not stacked on a saved delay | `tests/engine.test.ts` |
| Diamond or chain, duration +3 | Downstream moves 3 days, not 6 | `tests/engine.test.ts` |

## HTTP

| Input | Result | Test |
| --- | --- | --- |
| Empty body, or a body that is not JSON | 400 `INVALID`, not 500 | `tests/http.test.ts` |
| BoardError from a route | That status and path, as JSON | `tests/http.test.ts` |

## Model

| Input | Result | Test |
| --- | --- | --- |
| Unknown id, self link, existing edge, or cycle in a proposal | Dropped, with a reason. Nothing written | `tests/suggest.test.ts` |
| High confidence on an edge that moves fewer days | Ranked below the edge that moves more days | `tests/suggest.test.ts` |
| Provider error body | Not forwarded to the browser | `tests/suggest.test.ts` |
| Fenced JSON with surrounding text | Parsed, extra text ignored | `tests/suggest.test.ts` |
| Rewrite with an arrow | Discarded. Engine fact sheet is shown | `tests/explain.test.ts` |
| Rewrite with a date not in the fact sheet | Discarded | `tests/explain.test.ts` |
| A finish date that is not in the sheet, written with a unicode hyphen | Folded to `YYYY-MM-DD`, then discarded | `tests/explain.test.ts` |
| "Held and blocked by…", or the wrong held-by name | Discarded | `tests/explain.test.ts` |
| Missing key, timeout, or unusable JSON | Labeled heuristic for suggestions, or the fact sheet for Why finish | `src/server/suggest.ts`, `src/server/explain.ts` |

Accept of a suggestion still calls `POST /api/dependencies`. A cycle there is the same 409 as a manual add.

## Isolation and limits

| Input | Result | Test |
| --- | --- | --- |
| Reset on board A | Board B keeps its schema duration | `tests/board-store.test.ts` |
| More than 12 new boards from one network in a minute | 429, the extra board is not seeded | `tests/board-store.test.ts` |
| Write count for board A is full | Board B can still write | `tests/board-store.test.ts` |

## Residual limits

These are not hidden passes. They are outside what the suite claims.

- CI does not drive the browser. Drag, Export, and the drawer were checked through the API and by hand, not by a UI test.
- Two servers can both pass a write limit if they read the same counter before either writes it. The counter is still in Postgres.
- There is no login. Anyone with the URL receives their own board.
- A model rewrite that fails the check is replaced by the fact sheet. That is the intended failure, and the board says it was discarded.
