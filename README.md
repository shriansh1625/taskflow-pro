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

The seed is nine tasks. The diamond is schema → API and schema → migration, both into integration tests.

## What this achieves

These are the behaviors on the [live board](https://taskflow-pro-mauve-one.vercel.app/). Each one has a button or a line on that page, and a test in this repo.

| Check | What you will see |
| --- | --- |
| Cycle detection | Open Integration tests and add Database schema as a prerequisite. The path is named. The edge is not saved. |
| Diamond | **Schema +3d** moves Integration tests by 3 days, not 6. Clicking it again does not add another 3. |
| Rollback | **Regress schema** takes Database schema out of Done. Backend API stays in In progress and turns Blocked. Columns are not dragged backward. |
| Stored dates | Only planned start and duration are stored. A slip does not rewrite them, so the next change cannot compound on a saved delay. |
| Cost of the order | On the seed, dependencies push the finish 6 days past the latest stored plan (7 Sept to 13 Sept). That gap is counted once. |
| Critical path | Tasks with zero slack are chips in the header. They are a set. They are not drawn as one dependency chain. |
| Suggestions | **Suggest** ranks proposals by days the engine would move, then by whether the edge would bind. **Accept** uses the same cycle check as a manual add. **Dismiss** writes nothing. |
| Finish explanation | **Why finish** asks for three sentences: the derived finish, who it is held by, and who it is blocked by. A rewrite is kept only when every date matches the engine, including dates typed with a different hyphen, and the held-by name is not merged into the blocked list. Otherwise the engine fact sheet is shown. |
| Separate boards | Each browser gets its own rows. **Reset** cannot change another visitor's schedule. The board id is an httpOnly cookie. |
| Limits that survive a new server | Writes, resets, suggestions, and explanations are counted in Postgres, per board. `GET /api/health` reports `rateLimits: "database"` and `isolation: "per-browser"`. |
| Tests | `npm test` covers the rows above. GitHub Actions runs the tests and `npm run typecheck` on `main`. |

Where to read the implementation:

- Schedule, cycles, slack, and the impact numbers: `src/engine`
- Save, seed, and per-browser rows: `src/server/board-store.ts`
- Cookie and the board id handed to every route: `src/middleware.ts`
- Proofs: `tests/engine.test.ts`, `tests/board-store.test.ts`, `tests/explain.test.ts`, `tests/architecture.test.ts`
- Layer rules and the database split: `docs/ARCHITECTURE.md`
- The AI-Tool declaration for the portal: `docs/AI-TOOL.md`

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

Local clone, `npm test`, and Docker stay on SQLite. The engine does not change. Vercel cannot keep a SQLite file, so production uses Neon Postgres with the same tables (`prisma/schema.postgres.prisma`). The first visit from a browser creates that browser's nine-task board. Do not put `file:./dev.db` on Vercel.

1. Create a Neon project at [https://console.neon.tech](https://console.neon.tech) (Free, no card). Region close to `iad` or `sin`.
2. Connect → copy the **direct** URI (hostname must **not** contain `-pooler`). It should look like `postgresql://...?sslmode=require`.
3. Import [https://github.com/shriansh1625/taskflow-pro](https://github.com/shriansh1625/taskflow-pro) into Vercel (Hobby).
4. Project → Settings → Environment Variables, for **Production and Preview**:
   - `DATABASE_URL` = that direct Neon URI
   - `GROQ_API_KEY` = your Groq key
   - `GROQ_MODEL` = `openai/gpt-oss-120b`
5. Deploy. The build creates the tables. The first browser to open the URL gets the 9-task diamond.
6. Open the `*.vercel.app` URL and run the walkthrough above. First click after Neon has slept can take a few seconds.

If Suggest says `heuristic`, `GROQ_API_KEY` is missing on Vercel. If the page errors about the database, the URI is pooled or not set.

## Limits

- There is no shared login. The httpOnly cookie is the editor for that browser's board. Two people do not edit one schedule at the same time.
- Working-day calendars and lag on an edge are out of scope. Duration is a whole UTC day.
- Critical path is the zero-slack set, not a Gantt chart.
- Live multi-region deploy is out of scope. Local clone and Docker use SQLite. The live site uses Neon. The scheduling math does not depend on which database Prisma talks to. `src/engine` is pure TypeScript.

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

## Docs

- `docs/DESIGN.md` — architecture, data model, and known limits (the combined design note)
- `docs/TEST-SUITE.md` — the 52 tests `npm test` runs
- `docs/FAILURE-CASES.md` — inputs the system is supposed to refuse
- `docs/ARCHITECTURE.md`
- `docs/EXECUTION.md`
- `docs/AI-TOOL.md`
