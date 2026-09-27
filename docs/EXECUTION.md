# Execution bible

Build window: 25 Sep 2026 08:00 to 28 Sep 2026 08:00. Code for this product is written inside that window.

## Locked rules

- One editor per board. Each browser holds its own board.
- Calendar days in UTC. Duration is a positive integer. No working-day calendar and no lag on an edge.
- Done counts only when that card is not Blocked.
- Cycle check and insert share one transaction.
- Every successful mutation returns the whole derived board.
- The model cannot insert an edge. Accept goes through the normal dependency write.
- Do not commit `node_modules`, `.env`, `.next`, database files, or secrets.

## Shown on the live board

[https://taskflow-pro-mauve-one.vercel.app/](https://taskflow-pro-mauve-one.vercel.app/) states the same rules in the header and runs them with the buttons:

- **Schema +3d** is the diamond. Integration tests move by 3 days, not 6, and a second click does not add another 3.
- **Regress schema** is the rollback. Backend API stays In progress and turns Blocked.
- Adding Database schema under Integration tests is the cycle. The path is named and nothing is saved.
- The line under the header is the cost of the order: on the seed, 6 days past the latest stored plan.
- **Suggest** and **Why finish** cannot write a date or an edge. A bad rewrite is discarded.
- **Reset** replaces only this browser's rows.
- `GET /api/health` returns `isolation: "per-browser"` and `rateLimits: "database"`.

## Acceptance tests

These live in `tests/engine.test.ts` and `tests/board-store.test.ts` and must stay green:

- Self link rejected.
- A -> B -> C, then C -> A rejected, path named, edge list unchanged.
- Diamond: A duration +3 moves D by 3, not 6.
- Chain: the same +3 still moves the last task by 3.
- A non-binding predecessor slip does not move the join.
- Removing the causing edge removes the delay, including after a persisted write.
- A, B, C all Done; A moves to In Progress; B and C stay in Done and become Blocked; A returning to Done clears both.
- Seed has 9 tasks, including the schema / API / migration / integration diamond.
- Invalid duration and impossible calendar dates are rejected before write.
- Planned start is not rewritten when downstream dates move.
- Resetting one board leaves another board's schema duration unchanged.
- A write limit is a database row. A second board is not blocked by the first board's count.

## Remaining outside this repo

- Public GitHub (required to submit).
- Live URL on Vercel, with Neon as the database. Each browser has its own board. Rate limits are rows in that database.
- Portal AI-Tool declaration tick, pointing at `docs/AI-TOOL.md`.
