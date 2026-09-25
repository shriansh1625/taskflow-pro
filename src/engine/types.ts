export const COLUMNS = ["BACKLOG", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export type Column = (typeof COLUMNS)[number];

export const COLUMN_RANK: Record<Column, number> = {
  BACKLOG: 0,
  IN_PROGRESS: 1,
  REVIEW: 2,
  DONE: 3,
};

export type Readiness = "BLOCKED" | "READY";

export type TaskInput = {
  id: string;
  title: string;
  description: string;
  column: Column;
  sortOrder: number;
  plannedStart: string;
  durationDays: number;
};

/** Predecessor must finish before successor may start. */
export type DependencyEdge = {
  predecessorId: string;
  successorId: string;
};

export type DerivedTask = TaskInput & {
  effectiveStart: string;
  effectiveFinish: string;
  bindingPredecessorId: string | null;
  readiness: Readiness;
  unmetPredecessorIds: string[];
  slackDays: number;
  onCriticalPath: boolean;
};

export type EdgeCode = "SELF" | "CYCLE" | "UNKNOWN" | "DUPLICATE";

export type EdgeRejection = {
  ok: false;
  code: EdgeCode;
  message: string;
  path: string[];
};

export type RecomputeResult =
  | { ok: true; tasks: DerivedTask[] }
  | { ok: false; code: "CYCLE" | "INVALID"; message: string };

export type BoardPayload = {
  tasks: DerivedTask[];
  edges: DependencyEdge[];
};

export type DateShift = {
  taskId: string;
  beforeFinish: string;
  afterFinish: string;
  deltaDays: number;
};

export type PreviewResult =
  | {
      ok: true;
      shifts: DateShift[];
      totalDaysMoved: number;
      bindsSuccessor: boolean;
    }
  | EdgeRejection;
