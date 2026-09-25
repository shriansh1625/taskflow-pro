import { addDays, diffDays, isIsoDate } from "./dates";
import { incomingMap, outgoingMap } from "./graph";
import type { DependencyEdge, DerivedTask, RecomputeResult, TaskInput } from "./types";

function topologicalOrder(
  tasks: TaskInput[],
  edges: DependencyEdge[],
): string[] | null {
  const indegree = new Map(tasks.map((task) => [task.id, 0]));
  const outgoing = outgoingMap(edges);
  for (const edge of edges) {
    indegree.set(edge.successorId, (indegree.get(edge.successorId) ?? 0) + 1);
  }

  const queue = tasks
    .map((task) => task.id)
    .filter((id) => indegree.get(id) === 0)
    .sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const successor of outgoing.get(id) ?? []) {
      const next = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, next);
      if (next === 0) {
        queue.push(successor);
        queue.sort();
      }
    }
  }

  return order.length === tasks.length ? order : null;
}

function invalidBoard(tasks: TaskInput[], edges: DependencyEdge[]): string | null {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) return `Duplicate task id ${task.id}.`;
    ids.add(task.id);
    if (!Number.isInteger(task.durationDays) || task.durationDays < 1) {
      return `${task.id} needs a duration of at least 1 day.`;
    }
    if (!isIsoDate(task.plannedStart)) {
      return `${task.id} needs a planned start as YYYY-MM-DD.`;
    }
  }

  for (const edge of edges) {
    if (edge.predecessorId === edge.successorId) {
      return "A task cannot depend on itself.";
    }
    if (!ids.has(edge.predecessorId) || !ids.has(edge.successorId)) {
      return "A dependency points at a task that is not on the board.";
    }
  }

  return null;
}

/**
 * Recompute effective dates and readiness from planned inputs.
 * Dates are never accumulated along paths. At a join, only the latest
 * predecessor finish counts. A predecessor counts as satisfied only when
 * it is in Done and not Blocked.
 */
export function recompute(tasks: TaskInput[], edges: DependencyEdge[]): RecomputeResult {
  const problem = invalidBoard(tasks, edges);
  if (problem) return { ok: false, code: "INVALID", message: problem };

  const order = topologicalOrder(tasks, edges);
  if (!order) {
    return {
      ok: false,
      code: "CYCLE",
      message: "The stored graph contains a cycle and was not scheduled.",
    };
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const incoming = incomingMap(edges);
  const outgoing = outgoingMap(edges);
  const derived = new Map<string, DerivedTask>();

  for (const id of order) {
    const task = byId.get(id)!;
    const predecessorIds = incoming.get(id) ?? [];
    let effectiveStart = task.plannedStart;
    let bindingPredecessorId: string | null = null;

    for (const predecessorId of predecessorIds) {
      const finish = derived.get(predecessorId)!.effectiveFinish;
      if (finish > effectiveStart) {
        effectiveStart = finish;
        bindingPredecessorId = predecessorId;
      }
    }

    const unmetPredecessorIds = predecessorIds.filter((predecessorId) => {
      const predecessor = derived.get(predecessorId)!;
      return !(predecessor.column === "DONE" && predecessor.readiness === "READY");
    });

    derived.set(id, {
      ...task,
      effectiveStart,
      effectiveFinish: addDays(effectiveStart, task.durationDays),
      bindingPredecessorId,
      readiness: unmetPredecessorIds.length > 0 ? "BLOCKED" : "READY",
      unmetPredecessorIds,
      slackDays: 0,
      onCriticalPath: false,
    });
  }

  const projectFinish = [...derived.values()].reduce(
    (latest, task) => (task.effectiveFinish > latest ? task.effectiveFinish : latest),
    "0000-01-01",
  );
  const lateStart = new Map<string, string>();

  for (const id of [...order].reverse()) {
    const task = derived.get(id)!;
    const successors = outgoing.get(id) ?? [];
    const lateFinish =
      successors.length === 0
        ? projectFinish
        : successors.reduce((earliest, successorId) => {
            const start = lateStart.get(successorId)!;
            return start < earliest ? start : earliest;
          }, "9999-12-31");
    const start = addDays(lateFinish, -task.durationDays);
    lateStart.set(id, start);
    const slackDays = diffDays(start, task.effectiveStart);
    task.slackDays = slackDays;
    task.onCriticalPath = slackDays === 0;
  }

  return { ok: true, tasks: order.map((id) => derived.get(id)!) };
}
