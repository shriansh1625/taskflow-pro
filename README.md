# TaskFlow Pro

Live demo: [https://taskflow-pro-mauve-one.vercel.app/](https://taskflow-pro-mauve-one.vercel.app/)

[![test](https://github.com/shriansh1625/taskflow-pro/actions/workflows/test.yml/badge.svg)](https://github.com/shriansh1625/taskflow-pro/actions/workflows/test.yml)

Public repo: [https://github.com/shriansh1625/taskflow-pro](https://github.com/shriansh1625/taskflow-pro)

A Kanban board whose order is a directed acyclic graph. The engine decides Ready and Blocked, rejects cycles, and moves downstream dates once when several paths carry the same upstream change.

```
Backlog              In progress         Done
Integration tests    Backend API         Database schema
Data migration       App shell           Auth model
Auth endpoints
API client
Release checklist
```

The diamond is schema → API and schema → migration, both into integration tests. Extending schema by 3 days moves integration tests by 3, not 6. The board states how many days the derived finish sits past the stored plan, how many tasks are held by a predecessor, and how many have zero slack. Those numbers are derived. A slip does not rewrite the stored planned start.

Each browser gets its own board. Reset stays in that browser. Write limits are rows in the database, so a new server keeps the same count.

## Judge walkthrough (2 minutes)

1. Click **Reset** so you are on the 9 seeded tasks.
2. Click **Schema +3d**. Integration tests move by 3 days, not 6 (diamond). The header **finish** moves by those same 3 days, once. The line under the header is how far that finish sits past the stored plan. Clicking the button again does not add another 3.
3. Drag **Integration tests** into In progress. The move is refused; the card names Backend API and Data migration.
4. Click **Regress schema**. Schema leaves Done. Backend API stays In progress and turns Blocked. Columns are not dragged backward.
5. Click **Suggest**. Proposals are ranked by days moved. Each row lists which finishes would move. Dropped rows show why the engine rejected them. Accept still runs the cycle checker. Dismiss writes nothing.
6. Click **Why finish**. The paragraph is a rewrite of engine facts (binding predecessor, blocked list, slack). If Groq is down, the same facts are shown and labeled engine. The model cannot change a date.
7. Open Integration tests and try adding Database schema as a prerequisite. The cycle is named and not saved.
8. Click **Export** for a JSON snapshot. The file states which fields are stored and which are derived.

`docs/AI-TOOL.md` is the AI-Tool Declaration.

## Run locally

Node 22. Do not copy a real Groq key into the repo.

```bash
git clone https://github.com/shriansh1625/taskflow-pro.git
cd taskflow-pro
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm test
npm run typecheck
npm run dev
```

Open `http://localhost:3000`. Health: `GET /api/health`.

Optional: set `GROQ_API_KEY` in `.env` for live suggestions via Groq `openai/gpt-oss-120b` at temperature 0. Without a key, the same panel uses a labeled heuristic. The engine still filters cycles and unknown ids. Never commit `.env`.

## Live URL (Vercel + Neon, $0)

Local clone, `npm test`, and Docker stay on SQLite. The engine does not change. Vercel cannot keep a SQLite file, so production uses Neon Postgres with the same tables (`prisma/schema.postgres.prisma`). An empty database seeds itself on first read.

1. Create a Neon project at [https://console.neon.tech](https://console.neon.tech) (Free, no card). Region close to `iad` or `sin`.
2. Connect → copy the **direct** URI (hostname must **not** contain `-pooler`). It should look like `postgresql://...?sslmode=require`.
3. Import [https://github.com/shriansh1625/taskflow-pro](https://github.com/shriansh1625/taskflow-pro) into Vercel (Hobby).
4. Project → Settings → Environment Variables, for **Production and Preview**:
   - `DATABASE_URL` = that direct Neon URI
   - `GROQ_API_KEY` = your Groq key
   - `GROQ_MODEL` = `openai/gpt-oss-120b`
5. Deploy. First request creates tables and the 9-task diamond. Do not put `file:./dev.db` on Vercel.
6. Open the `*.vercel.app` URL and run the walkthrough above. First click after Neon has slept can take a few seconds.

If Suggest says `heuristic`, `GROQ_API_KEY` is missing on Vercel. If the page errors about the database, the URI is pooled or not set.

## What this does not do

Do not point Vercel at `file:./dev.db`. That SQLite file does not exist on serverless. The live path is Neon Postgres, documented above. Local clone and Docker still use SQLite.

This sprint gives each browser its own board and one editor for that board. There is no shared login. The cookie that identifies the board is httpOnly, so page scripts cannot read it, and a reset in one browser cannot see another browser's rows.

The scheduling math does not depend on which database Prisma talks to. `src/engine` is pure TypeScript.

## API

Each successful write returns the full derived board. Malformed JSON is `400`, not `500`.

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
- `POST /api/explain`

## Key assumptions

- One editor per board. Each browser holds its own board.
- A predecessor is satisfied only when it is in Done and not Blocked.
- Duration is a positive whole number of calendar days. There is no working-day calendar.
- Planned start and duration are the only stored dates. Effective dates are computed on read.
- Dates are UTC calendar dates.

## Limitations

- Working-day calendars, lags on individual edges, and live multi-user editing of the same board are out of scope. Separate browsers do not share a board.
- Critical path is a zero-slack highlight, not a separate Gantt.
- Live multi-region deploy is out of scope; SQLite is the local store.

## Docs

- `docs/ARCHITECTURE.md`
- `docs/EXECUTION.md`
- `docs/AI-TOOL.md`
