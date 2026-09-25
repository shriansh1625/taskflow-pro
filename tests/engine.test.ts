import { describe, expect, it } from "vitest";
import {
  addDays,
  evaluateNewEdge,
  invalidTaskFields,
  moveDecision,
  previewDependency,
  recompute,
  type DependencyEdge,
  type TaskInput,
} from "@/engine";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";

function task(overrides: Partial<TaskInput> & Pick<TaskInput, "id">): TaskInput {
  return {
    title: overrides.id,
    description: "",
    column: "BACKLOG",
    sortOrder: 0,
    plannedStart: "2026-09-01",
    durationDays: 3,
    ...overrides,
  };
}

function finishOf(tasks: TaskInput[], edges: DependencyEdge[], id: string): string {
  const result = recompute(tasks, edges);
  if (!result.ok) throw new Error(result.message);
  return result.tasks.find((item) => item.id === id)!.effectiveFinish;
}

describe("dates", () => {
  it("crosses a month boundary in UTC", () => {
    expect(addDays("2026-09-28", 3)).toBe("2026-10-01");
  });

  it("rejects a zero duration before any write", () => {
    expect(invalidTaskFields({ durationDays: 0 })).toMatch(/Duration/);
  });
});

describe("cycles", () => {
  const tasks = [task({ id: "A" }), task({ id: "B" }), task({ id: "C" })];
  const ids = new Set(tasks.map((item) => item.id));
  const edges: DependencyEdge[] = [
    { predecessorId: "A", successorId: "B" },
    { predecessorId: "B", successorId: "C" },
  ];

  it("rejects a self link", () => {
    const result = evaluateNewEdge(ids, edges, "A", "A");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SELF");
  });

  it("rejects a cycle and names the path without changing the stored edges", () => {
    const before = edges.length;
    const result = evaluateNewEdge(ids, edges, "C", "A");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CYCLE");
      expect(result.path).toEqual(["C", "A", "B", "C"]);
    }
    expect(edges).toHaveLength(before);
  });

  it("rejects a two-node loop", () => {
    const result = evaluateNewEdge(ids, [{ predecessorId: "A", successorId: "B" }], "B", "A");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.path).toEqual(["B", "A", "B"]);
  });
});

describe("schedule", () => {
  it("moves the diamond by 3 days, not 6", () => {
    const tasks = ["A", "B", "C", "D"].map((id) => task({ id }));
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "A", successorId: "C" },
      { predecessorId: "B", successorId: "D" },
      { predecessorId: "C", successorId: "D" },
    ];
    const before = finishOf(tasks, edges, "D");
    tasks[0] = { ...tasks[0], durationDays: 6 };
    const after = finishOf(tasks, edges, "D");
    expect(after).toBe(addDays(before, 3));
  });

  it("moves a chain by 3 days, not 6", () => {
    const tasks = ["A", "B", "D"].map((id) => task({ id }));
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "B", successorId: "D" },
    ];
    const before = finishOf(tasks, edges, "D");
    tasks[0] = { ...tasks[0], durationDays: 6 };
    expect(finishOf(tasks, edges, "D")).toBe(addDays(before, 3));
  });

  it("does not move a task when the slipped predecessor is not binding", () => {
    const tasks = [
      task({ id: "A", durationDays: 2 }),
      task({ id: "C", plannedStart: "2026-09-20", durationDays: 2 }),
      task({ id: "D", durationDays: 1 }),
    ];
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "D" },
      { predecessorId: "C", successorId: "D" },
    ];
    const before = recompute(tasks, edges);
    tasks[0] = { ...tasks[0], durationDays: 5 };
    const after = recompute(tasks, edges);
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    const earlier = before.tasks.find((item) => item.id === "D")!;
    const later = after.tasks.find((item) => item.id === "D")!;
    expect(later.effectiveFinish).toBe(earlier.effectiveFinish);
    expect(later.bindingPredecessorId).toBe("C");
  });

  it("drops a delay when the edge that caused it is removed", () => {
    const tasks = ["A", "D"].map((id) => task({ id, durationDays: 2 }));
    const withEdge = finishOf(tasks, [{ predecessorId: "A", successorId: "D" }], "D");
    const withoutEdge = finishOf(tasks, [], "D");
    expect(withoutEdge < withEdge).toBe(true);
  });

  it("adds a second slip on top of planned inputs, not on a stored delay", () => {
    const tasks = ["A", "B", "D"].map((id) => task({ id }));
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "B", successorId: "D" },
    ];
    const original = finishOf(tasks, edges, "D");
    tasks[0] = { ...tasks[0], durationDays: 5 };
    const afterThree = finishOf(tasks, edges, "D");
    tasks[0] = { ...tasks[0], durationDays: 7 };
    const afterFive = finishOf(tasks, edges, "D");
    expect(afterThree).toBe(addDays(original, 2));
    expect(afterFive).toBe(addDays(original, 4));
  });
});

describe("readiness", () => {
  it("blocks a done successor when an upstream task leaves Done", () => {
    const tasks = ["A", "B", "C"].map((id) => task({ id, column: "DONE", durationDays: 1 }));
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "B", successorId: "C" },
    ];
    tasks[0] = { ...tasks[0], column: "IN_PROGRESS" };
    const result = recompute(tasks, edges);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.tasks.map((item) => [item.id, item]));
    expect(byId.get("B")).toMatchObject({ column: "DONE", readiness: "BLOCKED", unmetPredecessorIds: ["A"] });
    expect(byId.get("C")).toMatchObject({ column: "DONE", readiness: "BLOCKED", unmetPredecessorIds: ["B"] });
  });

  it("clears the chain when the upstream task returns to Done", () => {
    const tasks = ["A", "B", "C"].map((id) => task({ id, column: "DONE", durationDays: 1 }));
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "B", successorId: "C" },
    ];
    const result = recompute(tasks, edges);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks.every((item) => item.readiness === "READY")).toBe(true);
  });

  it("refuses a forward move while blocked and allows a move backward", () => {
    const blocked = task({ id: "B", column: "BACKLOG" });
    const derived = {
      ...blocked,
      effectiveStart: blocked.plannedStart,
      effectiveFinish: "2026-09-04",
      bindingPredecessorId: "A",
      readiness: "BLOCKED" as const,
      unmetPredecessorIds: ["A"],
      slackDays: 0,
      onCriticalPath: false,
    };
    expect(moveDecision(derived, "IN_PROGRESS").ok).toBe(false);
    expect(moveDecision(derived, "BACKLOG").ok).toBe(true);
    expect(moveDecision({ ...derived, readiness: "READY", unmetPredecessorIds: [] }, "REVIEW").ok).toBe(true);
  });
});

describe("preview", () => {
  it("reports zero days when the new edge does not bind", () => {
    const tasks = [
      task({ id: "A", durationDays: 2 }),
      task({ id: "B", durationDays: 5 }),
      task({ id: "D", durationDays: 1 }),
    ];
    const edges: DependencyEdge[] = [
      { predecessorId: "A", successorId: "B" },
      { predecessorId: "B", successorId: "D" },
    ];
    const preview = previewDependency(tasks, edges, "A", "D");
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.totalDaysMoved).toBe(0);
    expect(preview.bindsSuccessor).toBe(false);
  });

  it("ranks a binding edge by the days it moves", () => {
    const tasks = [task({ id: "A", durationDays: 4 }), task({ id: "D", durationDays: 1 })];
    const preview = previewDependency(tasks, [], "A", "D");
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.bindsSuccessor).toBe(true);
    expect(preview.totalDaysMoved).toBeGreaterThan(0);
  });
});

describe("seed board", () => {
  it("has 9 tasks and a diamond that moves 3 days", () => {
    expect(SEED_TASKS).toHaveLength(9);
    const before = finishOf(SEED_TASKS, SEED_EDGES, "integration");
    const slipped = SEED_TASKS.map((item) =>
      item.id === "schema" ? { ...item, durationDays: item.durationDays + 3 } : item,
    );
    expect(finishOf(slipped, SEED_EDGES, "integration")).toBe(addDays(before, 3));
  });
});

describe("invariants", () => {
  it("does not rewrite planned start when a predecessor slips", () => {
    const tasks = [task({ id: "A" }), task({ id: "B" })];
    const edges: DependencyEdge[] = [{ predecessorId: "A", successorId: "B" }];
    const planned = tasks[1].plannedStart;
    tasks[0] = { ...tasks[0], durationDays: 9 };
    const result = recompute(tasks, edges);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks.find((item) => item.id === "B")?.plannedStart).toBe(planned);
    expect(tasks[1].plannedStart).toBe(planned);
  });

  it("rejects an impossible calendar date before scheduling", () => {
    expect(invalidTaskFields({ plannedStart: "2026-02-30" })).toMatch(/date/);
    const result = recompute([task({ id: "A", plannedStart: "2026-02-30" })], []);
    expect(result.ok).toBe(false);
  });

  it("schedules an empty board", () => {
    const result = recompute([], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks).toEqual([]);
  });

  it("refuses to schedule a stored cycle", () => {
    const result = recompute(
      [task({ id: "A" }), task({ id: "B" })],
      [
        { predecessorId: "A", successorId: "B" },
        { predecessorId: "B", successorId: "A" },
      ],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CYCLE");
  });

  it("binds the lexicographically smaller predecessor on a finish tie", () => {
    const tasks = [
      task({ id: "C", durationDays: 4 }),
      task({ id: "A", durationDays: 4 }),
      task({ id: "D", durationDays: 1 }),
    ];
    const result = recompute(tasks, [
      { predecessorId: "C", successorId: "D" },
      { predecessorId: "A", successorId: "D" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks.find((item) => item.id === "D")?.bindingPredecessorId).toBe("A");
  });
});
