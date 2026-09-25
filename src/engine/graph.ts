import type { DependencyEdge } from "./types";

export function incomingMap(edges: DependencyEdge[]): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.successorId) ?? [];
    list.push(edge.predecessorId);
    incoming.set(edge.successorId, list);
  }
  for (const list of incoming.values()) list.sort();
  return incoming;
}

export function outgoingMap(edges: DependencyEdge[]): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.predecessorId) ?? [];
    list.push(edge.successorId);
    outgoing.set(edge.predecessorId, list);
  }
  for (const list of outgoing.values()) list.sort();
  return outgoing;
}
