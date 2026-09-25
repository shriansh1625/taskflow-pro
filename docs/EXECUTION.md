# Execution bible

Build window: 25 Sep 2026 08:00 to 28 Sep 2026 08:00. Code for this product is written inside that window.

## Locked rules

- One board, one editor.
- Calendar days in UTC. Duration is a positive integer. No working-day calendar and no lag on an edge.
- Done counts only when that card is not Blocked.
- Cycle check and insert share one transaction.
- Every successful mutation returns the whole derived board.
- The model cannot insert an edge. Accept goes through the normal dependency write.
- Do not commit `node_modules`, `.env`, `.next`, database files, or secrets.

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

## Remaining outside this repo

- Public GitHub (required to submit).
- Live URL, if a disk host is available. Not Vercel serverless.
- Portal AI-Tool declaration tick, pointing at `docs/AI-TOOL.md`.
