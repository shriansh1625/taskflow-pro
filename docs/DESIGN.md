# Design

Combined note for the build submission: architecture, data model, and known limits. Branch: `main`.

Live board: https://taskflow-pro-mauve-one.vercel.app/

## Architecture

Four columns: Backlog, In Progress, Review, Done. The schedule rules live in `src/engine` and do not import the database, HTTP, or React.

```
UI (Kanban, drawer, suggest, export)     src/components
        |  fetch only
        v
Route handlers                           src/app/api
        |  one JSON error policy
        v
board-store                              src/server
        |  cycle check and insert in one transaction
        v
engine                                   src/engine
```

`tests/architecture.test.ts` fails the build if the UI imports the database, the engine imports Prisma or React, or the server imports a React component.

A predecessor counts only when it is Done and not Blocked. At a join, only the latest predecessor finish counts, so a diamond moves the successor once. Planned start and duration are the only stored dates. Effective dates, readiness, slack, and zero-slack membership are derived on read.

The model may propose an edge or rewrite a fact sheet. It cannot insert an edge or write a date. Accept uses the same dependency write as a person. A rewrite is kept only when its dates, held-by name, and blocked-by names match the engine.

## Data model

`prisma/schema.prisma` is the only model definition. Postgres on Vercel is that file with the provider swapped. Local tests and Docker use SQLite.

| Stored | Meaning |
| --- | --- |
| `Task.boardId` + `Task.logicalId` | One browser's task. The row id is `boardId:logicalId`, so two boards can both have `schema`. |
| `Task.column`, `sortOrder` | Where the card sits. A blocked card cannot move to a later column. |
| `Task.plannedStart`, `durationDays` | The only dates. `YYYY-MM-DD` and a whole number of UTC days. |
| `Dependency.boardId`, predecessor, successor | An edge on that board. Cascade-deleted with the task. |
| `RateBucket` | A one-minute counter in the database, shared by every server. |

Not stored: effective start, effective finish, binding predecessor, Ready or Blocked, slack, critical path. Those are computed by `recompute` and dropped before the model catalog is built.

Each browser gets an httpOnly cookie. Middleware copies that id onto the request. Handlers do not trust a board id typed by the client. Reset deletes only that board's rows.

## Known limits

- One editor per board. Two people do not edit the same schedule.
- There is no user account. The cookie is the capability.
- Duration is a UTC calendar day. There is no working-day calendar and no lag on an edge.
- Critical path is the set of tasks with zero slack, not one drawn chain and not a Gantt chart.
- The write-limit counter can admit a few extra requests if two servers increment the same window at the same instant. The count still lives in the database, so a new server does not start from zero.
- CI runs the test suite and the typecheck. It does not click the live page.
- If a model rewrite fails the date or name check, the board shows the engine fact sheet instead of the rewrite.

The cases the system is built to refuse are listed in `docs/FAILURE-CASES.md`. The tests that lock those cases are listed in `docs/TEST-SUITE.md`.
