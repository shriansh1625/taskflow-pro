import type { BoardPayload, Column, PreviewResult } from "@/engine";

export type ApiError = {
  error: string;
  code?: string;
  path?: string[];
};

async function parse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & ApiError;
  if (!response.ok) {
    throw data;
  }
  return data;
}

export async function fetchBoard(): Promise<BoardPayload> {
  return parse(await fetch("/api/board", { cache: "no-store" }));
}

export async function createTask(input: {
  title: string;
  description: string;
  plannedStart: string;
  durationDays: number;
  column?: Column;
}): Promise<BoardPayload> {
  return parse(
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function patchTask(
  id: string,
  patch: {
    title?: string;
    description?: string;
    plannedStart?: string;
    durationDays?: number;
  },
): Promise<BoardPayload> {
  return parse(
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function moveTaskRequest(
  id: string,
  column: Column,
  sortOrder: number,
): Promise<BoardPayload> {
  return parse(
    await fetch(`/api/tasks/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column, sortOrder }),
    }),
  );
}

export async function deleteTaskRequest(id: string): Promise<BoardPayload> {
  return parse(await fetch(`/api/tasks/${id}`, { method: "DELETE" }));
}

export async function addDependencyRequest(
  predecessorId: string,
  successorId: string,
): Promise<BoardPayload> {
  return parse(
    await fetch("/api/dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorId, successorId }),
    }),
  );
}

export async function removeDependencyRequest(
  predecessorId: string,
  successorId: string,
): Promise<BoardPayload> {
  return parse(
    await fetch("/api/dependencies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorId, successorId }),
    }),
  );
}

export async function previewDependencyRequest(
  predecessorId: string,
  successorId: string,
): Promise<PreviewResult> {
  return parse(
    await fetch("/api/dependencies/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorId, successorId }),
    }),
  );
}

export type RankedSuggestion = {
  predecessorId: string;
  successorId: string;
  reason: string;
  confidence: number;
  source: "model" | "heuristic";
  totalDaysMoved: number;
  bindsSuccessor: boolean;
  preview: {
    shifts: { taskId: string; beforeFinish: string; afterFinish: string; deltaDays: number }[];
  };
};

export type SuggestionReport = {
  source: "model" | "heuristic" | "mixed";
  suggestions: RankedSuggestion[];
  dropped: { predecessorId: string; successorId: string; dropReason: string }[];
  modelError: string | null;
};

export type Explanation = {
  source: "model" | "engine";
  text: string;
  note: string | null;
};

export async function requestExplanation(taskId?: string): Promise<Explanation> {
  return parse(
    await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskId ? { taskId } : {}),
    }),
  );
}

export async function requestSuggestions(): Promise<SuggestionReport> {
  return parse(
    await fetch("/api/suggestions", {
      method: "POST",
    }),
  );
}

export async function resetBoardRequest(): Promise<BoardPayload> {
  return parse(await fetch("/api/board/reset", { method: "POST" }));
}
