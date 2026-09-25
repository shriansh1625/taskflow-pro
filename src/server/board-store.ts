import type { Prisma, PrismaClient } from "@prisma/client";
import {
  evaluateNewEdge,
  invalidTaskFields,
  moveDecision,
  previewDependency,
  recompute,
  type Column,
  type DependencyEdge,
  type PreviewResult,
  type TaskInput,
  type BoardPayload,
} from "@/engine";
import { prisma } from "./db";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";

type Db = PrismaClient | Prisma.TransactionClient;

export class BoardError extends Error {
  readonly status: number;
  readonly code: string;
  readonly path: string[];

  constructor(status: number, code: string, message: string, path: string[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.path = path;
  }
}

async function loadTasks(db: Db): Promise<TaskInput[]> {
  const rows = await db.task.findMany({ orderBy: [{ column: "asc" }, { sortOrder: "asc" }] });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    column: row.column as Column,
    sortOrder: row.sortOrder,
    plannedStart: row.plannedStart,
    durationDays: row.durationDays,
  }));
}

async function loadEdges(db: Db): Promise<DependencyEdge[]> {
  const rows = await db.dependency.findMany({
    orderBy: [{ predecessorId: "asc" }, { successorId: "asc" }],
  });
  return rows.map((row) => ({
    predecessorId: row.predecessorId,
    successorId: row.successorId,
  }));
}

function derive(tasks: TaskInput[], edges: DependencyEdge[]): BoardPayload {
  const result = recompute(tasks, edges);
  if (!result.ok) {
    throw new BoardError(500, result.code, result.message);
  }
  return { tasks: result.tasks, edges };
}

export async function getBoard(db: Db = prisma): Promise<BoardPayload> {
  if (db === prisma) {
    const count = await db.task.count();
    if (count === 0) {
      return resetBoard(prisma);
    }
  }
  const tasks = await loadTasks(db);
  const edges = await loadEdges(db);
  return derive(tasks, edges);
}

function slugId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || `task-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createTask(
  input: {
    id?: string;
    title: string;
    description?: string;
    column?: Column;
    sortOrder?: number;
    plannedStart: string;
    durationDays: number;
  },
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  const problem = invalidTaskFields({
    title: input.title,
    plannedStart: input.plannedStart,
    durationDays: input.durationDays,
  });
  if (problem) throw new BoardError(400, "INVALID", problem);

  const column = input.column ?? "BACKLOG";
  const sortOrder =
    input.sortOrder ?? (await db.task.count({ where: { column } }));
  let id = input.id ?? slugId(input.title);

  try {
    await db.task.create({
      data: {
        id,
        title: input.title.slice(0, 120),
        description: (input.description ?? "").slice(0, 2000),
        column,
        sortOrder,
        plannedStart: input.plannedStart,
        durationDays: input.durationDays,
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
    id = `${slugId(input.title)}-${crypto.randomUUID().slice(0, 6)}`;
    await db.task.create({
      data: {
        id,
        title: input.title.slice(0, 120),
        description: (input.description ?? "").slice(0, 2000),
        column,
        sortOrder,
        plannedStart: input.plannedStart,
        durationDays: input.durationDays,
      },
    });
  }

  return getBoard(db);
}

export async function updateTask(
  id: string,
  patch: {
    title?: string;
    description?: string;
    plannedStart?: string;
    durationDays?: number;
  },
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) throw new BoardError(404, "NOT_FOUND", `Task ${id} was not found.`);

  const problem = invalidTaskFields({
    title: patch.title,
    plannedStart: patch.plannedStart,
    durationDays: patch.durationDays,
  });
  if (problem) throw new BoardError(400, "INVALID", problem);

  await db.task.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.slice(0, 2000) }
        : {}),
      ...(patch.plannedStart !== undefined ? { plannedStart: patch.plannedStart } : {}),
      ...(patch.durationDays !== undefined ? { durationDays: patch.durationDays } : {}),
    },
  });

  return getBoard(db);
}

export async function moveTask(
  id: string,
  toColumn: Column,
  sortOrder: number,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  return db.$transaction(async (tx) => {
    const board = await getBoard(tx);
    const task = board.tasks.find((item) => item.id === id);
    if (!task) throw new BoardError(404, "NOT_FOUND", `Task ${id} was not found.`);

    const titles = new Map(board.tasks.map((item) => [item.id, item.title]));
    const decision = moveDecision(task, toColumn, titles);
    if (!decision.ok) {
      throw new BoardError(409, "BLOCKED", decision.message);
    }

    const fromColumn = task.column;
    const inColumn = (column: Column) =>
      board.tasks
        .filter((item) => item.column === column && item.id !== id)
        .sort((left, right) => left.sortOrder - right.sortOrder);

    const updates: { id: string; column: Column; sortOrder: number }[] = [];

    if (fromColumn === toColumn) {
      const list = inColumn(toColumn);
      const insertAt = Math.max(0, Math.min(sortOrder, list.length));
      list.splice(insertAt, 0, task);
      list.forEach((item, index) => {
        updates.push({ id: item.id, column: toColumn, sortOrder: index });
      });
    } else {
      inColumn(fromColumn).forEach((item, index) => {
        updates.push({ id: item.id, column: fromColumn, sortOrder: index });
      });
      const dest = inColumn(toColumn);
      const insertAt = Math.max(0, Math.min(sortOrder, dest.length));
      dest.splice(insertAt, 0, task);
      dest.forEach((item, index) => {
        updates.push({ id: item.id, column: toColumn, sortOrder: index });
      });
    }

    for (const update of updates) {
      await tx.task.update({
        where: { id: update.id },
        data: { column: update.column, sortOrder: update.sortOrder },
      });
    }

    return derive(await loadTasks(tx), await loadEdges(tx));
  });
}

export async function deleteTask(id: string, db: PrismaClient = prisma): Promise<BoardPayload> {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) throw new BoardError(404, "NOT_FOUND", `Task ${id} was not found.`);
  await db.task.delete({ where: { id } });
  return getBoard(db);
}

export async function resetBoard(db: PrismaClient = prisma): Promise<BoardPayload> {
  await db.$transaction(async (tx) => {
    await tx.dependency.deleteMany();
    await tx.task.deleteMany();
    for (const task of SEED_TASKS) {
      await tx.task.create({ data: task });
    }
    for (const edge of SEED_EDGES) {
      await tx.dependency.create({ data: edge });
    }
  });
  return getBoard(db);
}

export async function previewNewDependency(
  predecessorId: string,
  successorId: string,
  db: PrismaClient = prisma,
): Promise<PreviewResult> {
  const tasks = await loadTasks(db);
  const edges = await loadEdges(db);
  return previewDependency(tasks, edges, predecessorId, successorId);
}

export async function addDependency(
  predecessorId: string,
  successorId: string,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  return db.$transaction(async (tx) => {
    const tasks = await loadTasks(tx);
    const edges = await loadEdges(tx);
    const gate = evaluateNewEdge(
      new Set(tasks.map((item) => item.id)),
      edges,
      predecessorId,
      successorId,
    );
    if (!gate.ok) {
      throw new BoardError(409, gate.code, gate.message, gate.path);
    }

    await tx.dependency.create({
      data: { predecessorId, successorId },
    });

    return derive(await loadTasks(tx), await loadEdges(tx));
  });
}

export async function removeDependency(
  predecessorId: string,
  successorId: string,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  const deleted = await db.dependency.deleteMany({
    where: { predecessorId, successorId },
  });
  if (deleted.count === 0) {
    throw new BoardError(404, "NOT_FOUND", "That dependency was not on the board.");
  }
  return getBoard(db);
}
