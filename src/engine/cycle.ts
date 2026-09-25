import type { DependencyEdge, EdgeRejection } from "./types";

function outgoingMap(edges: DependencyEdge[]): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const next = outgoing.get(edge.predecessorId) ?? [];
    next.push(edge.successorId);
    outgoing.set(edge.predecessorId, next);
  }
  for (const next of outgoing.values()) next.sort();
  return outgoing;
}

/** Shortest path from start to goal along predecessor -> successor edges. */
export function pathFrom(
  edges: DependencyEdge[],
  start: string,
  goal: string,
): string[] | null {
  if (start === goal) return null;
  const outgoing = outgoingMap(edges);
  const previous = new Map<string, string | null>([[start, null]]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const successor of outgoing.get(current) ?? []) {
      if (previous.has(successor)) continue;
      previous.set(successor, current);
      if (successor === goal) {
        const path: string[] = [];
        let cursor: string | null = goal;
        while (cursor) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        path.reverse();
        return path;
      }
      queue.push(successor);
    }
  }

  return null;
}

export function evaluateNewEdge(
  taskIds: ReadonlySet<string>,
  edges: DependencyEdge[],
  predecessorId: string,
  successorId: string,
): { ok: true } | EdgeRejection {
  if (!taskIds.has(predecessorId) || !taskIds.has(successorId)) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Both tasks must already be on the board.",
      path: [],
    };
  }

  if (predecessorId === successorId) {
    return {
      ok: false,
      code: "SELF",
      message: "A task cannot depend on itself.",
      path: [predecessorId, predecessorId],
    };
  }

  if (
    edges.some(
      (edge) =>
        edge.predecessorId === predecessorId && edge.successorId === successorId,
    )
  ) {
    return {
      ok: false,
      code: "DUPLICATE",
      message: "That dependency already exists.",
      path: [predecessorId, successorId],
    };
  }

  const downstream = pathFrom(edges, successorId, predecessorId);
  if (downstream) {
    const path = [predecessorId, ...downstream];
    return {
      ok: false,
      code: "CYCLE",
      message: `Dependency would create a cycle: ${path.join(" -> ")}`,
      path,
    };
  }

  return { ok: true };
}
