# TaskFlow Pro architecture

The board is four columns: Backlog, In Progress, Review, Done. Correctness lives in `src/engine` and does not import the database, HTTP, or React.

```
UI (Kanban, drawer, suggest, export)
        |
        v
Next.js route handlers
        |
        v
board-store  --transaction-->  SQLite (local, tests, Docker)
                            or Postgres (Vercel + Neon)
        |
        v
engine.recompute / evaluateNewEdge / previewDependency
```

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

Prisma over SQLite for clone, tests, and Docker. Production on Vercel uses the same models on Neon Postgres (`prisma/schema.postgres.prisma`). The engine does not know about Prisma. Cycle, diamond, and rollback math do not change with the provider. An empty store seeds the nine-task diamond on first read.

CI on `main` runs `npm test` and `npm run typecheck` against SQLite.

Do not set `DATABASE_URL=file:./dev.db` on Vercel.

## Security boundary

- `GROQ_API_KEY` is server-only. It is never shipped to the client bundle.
- Suggestion and reset routes are rate-limited in process.
- There is no login in this sprint (one editor). Treat the process as a local demo, not a public multi-tenant app.
- `GET /api/health` reports task counts and whether suggestions would use the model. It does not echo secrets.
