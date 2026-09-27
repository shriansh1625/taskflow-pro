# TaskFlow Pro architecture

The board is four columns: Backlog, In Progress, Review, Done. Correctness lives in `src/engine` and does not import the database, HTTP, or React.

What that split is there to protect:

| Guarantee | Where it is enforced |
| --- | --- |
| A cycle is named and not written | `src/engine/cycle.ts`, then the same check inside the dependency transaction in `src/server/board-store.ts` |
| A diamond moves the join once | `src/engine/schedule.ts` keeps the latest predecessor finish only |
| A rollback does not drag columns backward | A predecessor counts only when it is Done and Ready |
| Derived dates are never stored | The task row keeps planned start and duration. Export and the model catalog use `storedTasks` for anything the model sees |
| One browser cannot reset another | `src/middleware.ts` sets an httpOnly cookie. Rows are stored under that board id |
| A new server does not forget the write limit | `RateBucket` in the database, read by every instance |
| The UI cannot import the database | `tests/architecture.test.ts` fails the build if the layer arrows below are broken |

```
UI (Kanban, drawer, suggest, export)     src/components
        |  fetch only. No Prisma.
        v
Route handlers                           src/app/api
        |  runRoute: one JSON error policy
        v
board-store                              src/server
        |  transaction around cycle check + insert
        v
engine                                   src/engine
        recompute, cycles, preview, explanations
```

`tests/architecture.test.ts` fails the build if those arrows are violated.

- `src/engine` cannot import Prisma, React, Next, or the filesystem.
- `src/components` cannot import `src/server` or Prisma. The browser talks to route handlers.
- `src/server` cannot import React components.
- `src/app/page.tsx` is the only UI entry that reads the store, and it runs on the server.

## Stored versus derived

Stored on a task: id, title, description, column, sort order, planned start (`YYYY-MM-DD`), duration in whole days.

Stored on an edge: predecessor id, successor id. The predecessor must finish before the successor may start.

Derived on every read, never written back: effective start, effective finish, binding predecessor, Blocked or Ready, unmet predecessor ids, slack, critical-path membership. A propagated date is not saved as a new planned start, so the next slip cannot compound onto a previous one.

Export writes that same derived snapshot as JSON. It is a report, not a second source of truth.

## Schedule

1. Reject a self link before search.
2. Reject a new edge when the successor can already reach the predecessor. Return the cycle path. Write nothing.
3. Cycle check and insert share one Prisma transaction.
4. Order the graph with Kahn's algorithm, each task once.
5. Effective start is the later of the planned start and the latest immediate predecessor finish. Ties keep the lexicographically smaller predecessor id.
6. Effective finish is effective start plus duration. The next task may start on that finish date.
7. At a join, only that latest finish counts. Extending A by 3 days moves D by 3 through both A-B-D and A-C-D.
8. A task is satisfied only when its column is Done and its readiness is Ready. Otherwise it is an unmet predecessor.
9. Readiness is computed in the same order, so a Done card that is Blocked does not satisfy the next Done card. Columns are not dragged backward.
10. Slack comes from a backward pass. Zero slack marks the critical path.

A blocked card may move to the same column or an earlier one. It may not move to a later column.

## Preview and suggestions

`previewDependency` runs the same function on a copy. It returns which finishes would move and whether the new edge would bind the successor. Nothing is stored.

The Groq model (`openai/gpt-oss-120b`, temperature 0) receives a closed catalog of stored ids, titles, descriptions, columns, planned starts, durations, and existing edges. It does not receive derived dates. Server-side grounding drops unknown ids, self-links, duplicates, existing edges, and cycles. Survivors are ranked by days moved, then bind, then confidence. Accept calls the same `addDependency` path as a manual add.

If the key is missing or Groq fails, a labeled heuristic uses the same filter. Provider error bodies are not sent to the browser.

## Persistence

`prisma/schema.prisma` is the only model definition. `prisma/schema.postgres.prisma` is that file with the provider set to PostgreSQL and a Vercel binary target. `postgresSchemaFromSqlite` produces it, and the architecture test rejects a hand-edited drift. Local clone, tests, and Docker use SQLite. Vercel generates the Postgres client and talks to Neon. The engine does not know which one is connected.

A task row is keyed by `boardId` plus its logical id. The first request from a browser sets an httpOnly cookie and seeds only that board. Reset deletes that board's rows. Another browser's cookie addresses different rows, so a public URL can host many judges without one reset wiping the others. An empty board is created only after a per-network limit stored in `RateBucket`.

Write, reset, suggestion, and explanation limits are fixed one-minute windows in that same table. Every Vercel instance reads the row for that board. A cold start does not zero the count.

Suggestions receive `storedTasks`, which strips effective dates before the catalog is built. Explanations may read derived fields. Neither path writes them back.

CI on `main` runs `npm test` and `npm run typecheck` against SQLite.

Do not set `DATABASE_URL=file:./dev.db` on Vercel.

## Security boundary

- `GROQ_API_KEY` is server-only. It is never shipped to the client bundle.
- The board id lives in an httpOnly, SameSite cookie. Middleware copies it onto the request. Handlers do not trust a client-supplied board id.
- Rate limits are rows in `RateBucket`, scoped to the board (and, for brand-new boards, to a hash of the network address). They are not an in-memory map.
- There is no user account. Possession of the cookie is the editor capability for that board.
- `GET /api/health` reports how many boards exist and whether suggestions would use the model. It does not return task rows or secrets.
