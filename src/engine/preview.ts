import { diffDays } from "./dates";
import { evaluateNewEdge } from "./cycle";
import { recompute } from "./schedule";
import type { Column, DependencyEdge, DerivedTask, PreviewResult, TaskInput } from "./types";
import { COLUMN_RANK } from "./types";

export function previewDependency(
  tasks: TaskInput[],
  edges: DependencyEdge[],
  predecessorId: string,
  successorId: string,
): PreviewResult {
  const gate = evaluateNewEdge(
    new Set(tasks.map((task) => task.id)),
    edges,
    predecessorId,
    successorId,
  );
  if (!gate.ok) return gate;

  const before = recompute(tasks, edges);
  const after = recompute(tasks, [...edges, { predecessorId, successorId }]);
  if (!before.ok) return { ok: false, code: "CYCLE", message: before.message, path: [] };
  if (!after.ok) return { ok: false, code: "CYCLE", message: after.message, path: [] };

  const beforeById = new Map(before.tasks.map((task) => [task.id, task]));
  const shifts = after.tasks
    .map((task) => {
      const previous = beforeById.get(task.id)!;
      return {
        taskId: task.id,
        beforeFinish: previous.effectiveFinish,
        afterFinish: task.effectiveFinish,
        deltaDays: diffDays(task.effectiveFinish, previous.effectiveFinish),
      };
    })
    .filter((shift) => shift.deltaDays !== 0)
    .sort((left, right) => Math.abs(right.deltaDays) - Math.abs(left.deltaDays));

  const successor = after.tasks.find((task) => task.id === successorId);
  return {
    ok: true,
    shifts,
    totalDaysMoved: shifts.reduce((sum, shift) => sum + Math.abs(shift.deltaDays), 0),
    bindsSuccessor: successor?.bindingPredecessorId === predecessorId,
  };
}

export function moveDecision(
  task: DerivedTask,
  to: Column,
  titles?: Map<string, string>,
): { ok: true } | { ok: false; message: string } {
  if (task.readiness === "BLOCKED" && COLUMN_RANK[to] > COLUMN_RANK[task.column]) {
    const blockers = task.unmetPredecessorIds
      .map((id) => titles?.get(id) ?? id)
      .join(", ");
    return {
      ok: false,
      message: `Blocked by ${blockers}. Finish those tasks before moving forward.`,
    };
  }
  return { ok: true };
}
