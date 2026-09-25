# TaskFlow Pro

A Kanban board whose order is a directed acyclic graph. The engine decides Ready and Blocked, rejects cycles, and moves downstream dates once when several paths carry the same upstream change.

## Judge walkthrough (2 minutes)

1. Click **Reset** so you are on the 9 seeded tasks.
2. Click **Schema +3d**. Integration tests move by 3 days, not 6 (diamond). Clicking it again does not add another 3. The header **finish** date is the latest derived finish.
3. Drag **Integration tests** into In progress. The move is refused; the card names Backend API and Data migration.
4. Click **Regress schema**. Schema leaves Done. Downstream Done cards stay in Done and turn Blocked.
5. Click **Suggest**. Proposals are ranked by days moved. Dropped rows show why the engine rejected them. Accept still runs the cycle checker. Dismiss writes nothing.
6. Open Integration tests and try adding Database schema as a prerequisite. The cycle is named and not saved.
7. Click **Export** for a JSON snapshot. The file states which fields are stored and which are derived.

`docs/AI-TOOL.md` is the AI-Tool Declaration.

## Run locally

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm test
npm run dev
```

Open `http://localhost:3000`. Health: `GET /api/health`.

Optional: set `GROQ_API_KEY` in `.env` for live suggestions via Groq `openai/gpt-oss-120b` at temperature 0. Without a key, the same panel uses a labeled heuristic. The engine still filters cycles and unknown ids. Never commit `.env`.

## What this does not do

Do not deploy this SQLite build to Vercel serverless. The database file is local. For a live URL use a host with a disk (Docker image in `Dockerfile`, or run the commands above on a small VM).

This sprint is one board and one editor. There is no login. Do not put the process on a public URL without an auth layer in front of it.

The scheduling math does not depend on SQLite. `src/engine` is pure TypeScript. A later Postgres swap is a Prisma provider change, not a rewrite of cycle detection or diamond counting.

## API

Each successful write returns the full derived board.

- `GET /api/board`
- `GET /api/health`
- `POST /api/board/reset`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/move`
- `POST /api/dependencies`
- `DELETE /api/dependencies`
- `POST /api/dependencies/preview`
- `POST /api/suggestions`

## Key assumptions

- One board and one editor in this sprint.
- A predecessor is satisfied only when it is in Done and not Blocked.
- Duration is a positive whole number of calendar days. There is no working-day calendar.
- Planned start and duration are the only stored dates. Effective dates are computed on read.
- Dates are UTC calendar dates.

## Limitations

- Working-day calendars, lags on individual edges, live multi-user editing, and multiple boards are out of scope.
- Critical path is a zero-slack highlight, not a separate Gantt.
- Live multi-region deploy is out of scope; SQLite is the local store.

## Docs

- `docs/ARCHITECTURE.md`
- `docs/EXECUTION.md`
- `docs/AI-TOOL.md`
