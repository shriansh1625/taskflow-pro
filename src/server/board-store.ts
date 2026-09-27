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
import { consumeLimit } from "./limit";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";

type Db = PrismaClient | Prisma.TransactionClient;

/** Boards created from tests and local scripts. HTTP sessions use a 32-char cookie id. */
export const LOCAL_BOARD = "local";

/** New boards per network per minute. An existing cookie does not spend this. */
export const NEW_BOARD_LIMIT = 12;

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

function assertBoardId(boardId: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(boardId)) {
    throw new BoardError(400, "NO_BOARD", "Missing board session. Refresh the page.");
  }
}

function storedId(boardId: string, logicalId: string): string {
  return `${boardId}:${logicalId}`;
}

function logicalOf(boardId: string, stored: string, logicalId: string): string {
  if (logicalId) return logicalId;
  const prefix = `${boardId}:`;
  return stored.startsWith(prefix) ? stored.slice(prefix.length) : stored;
}

async function loadTasks(db: Db, boardId: string): Promise<TaskInput[]> {
  const rows = await db.task.findMany({
    where: { boardId },
    orderBy: [{ column: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map((row) => ({
    id: logicalOf(boardId, row.id, row.logicalId),
    title: row.title,
    description: row.description,
    column: row.column as Column,
    sortOrder: row.sortOrder,
    plannedStart: row.plannedStart,
    durationDays: row.durationDays,
  }));
}

async function loadEdges(db: Db, boardId: string): Promise<DependencyEdge[]> {
  const rows = await db.dependency.findMany({
    where: { boardId },
    orderBy: [{ predecessorId: "asc" }, { successorId: "asc" }],
  });
  const prefix = `${boardId}:`;
  return rows.map((row) => ({
    predecessorId: row.predecessorId.startsWith(prefix)
      ? row.predecessorId.slice(prefix.length)
      : row.predecessorId,
    successorId: row.successorId.startsWith(prefix)
      ? row.successorId.slice(prefix.length)
      : row.successorId,
  }));
}

function derive(tasks: TaskInput[], edges: DependencyEdge[]): BoardPayload {
  const result = recompute(tasks, edges);
  if (!result.ok) {
    throw new BoardError(500, result.code, result.message);
  }
  return { tasks: result.tasks, edges };
}

export async function getBoard(boardId = LOCAL_BOARD, db: Db = prisma): Promise<BoardPayload> {
  assertBoardId(boardId);
  return derive(await loadTasks(db, boardId), await loadEdges(db, boardId));
}

/**
 * First visit for a browser. Seeds only that board, and only if this network
 * has not already opened too many new boards this minute.
 */
export async function openBoard(
  boardId: string,
  actorKey: string,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  const count = await db.task.count({ where: { boardId } });
  if (count === 0) {
    const allowed = await consumeLimit(`actor:${actorKey}`, "create-board", NEW_BOARD_LIMIT);
    if (!allowed) {
      throw new BoardError(
        429,
        "RATE_LIMIT",
        "Too many new boards from this network. Try again in a minute.",
      );
    }
    return resetBoard(boardId, db);
  }
  return getBoard(boardId, db);
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
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  const problem = invalidTaskFields({
    title: input.title,
    plannedStart: input.plannedStart,
    durationDays: input.durationDays,
  });
  if (problem) throw new BoardError(400, "INVALID", problem);

  const column = input.column ?? "BACKLOG";
  const sortOrder = input.sortOrder ?? (await db.task.count({ where: { boardId, column } }));
  let logicalId = input.id ?? slugId(input.title);

  const write = (id: string) =>
    db.task.create({
      data: {
        id: storedId(boardId, id),
        boardId,
        logicalId: id,
        title: input.title.slice(0, 120),
        description: (input.description ?? "").slice(0, 2000),
        column,
        sortOrder,
        plannedStart: input.plannedStart,
        durationDays: input.durationDays,
      },
    });

  try {
    await write(logicalId);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
    logicalId = `${slugId(input.title)}-${crypto.randomUUID().slice(0, 6)}`;
    await write(logicalId);
  }

  return getBoard(boardId, db);
}

export async function updateTask(
  id: string,
  patch: {
    title?: string;
    description?: string;
    plannedStart?: string;
    durationDays?: number;
  },
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  const existing = await db.task.findUnique({ where: { id: storedId(boardId, id) } });
  if (!existing || existing.boardId !== boardId) {
    throw new BoardError(404, "NOT_FOUND", `Task ${id} was not found.`);
  }

  const problem = invalidTaskFields({
    title: patch.title,
    plannedStart: patch.plannedStart,
    durationDays: patch.durationDays,
  });
  if (problem) throw new BoardError(400, "INVALID", problem);

  await db.task.update({
    where: { id: storedId(boardId, id) },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.description !== undefined ? { description: patch.description.slice(0, 2000) } : {}),
      ...(patch.plannedStart !== undefined ? { plannedStart: patch.plannedStart } : {}),
      ...(patch.durationDays !== undefined ? { durationDays: patch.durationDays } : {}),
    },
  });

  return getBoard(boardId, db);
}

export async function moveTask(
  id: string,
  toColumn: Column,
  sortOrder: number,
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  return db.$transaction(async (tx) => {
    const board = await getBoard(boardId, tx);
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
        where: { id: storedId(boardId, update.id) },
        data: { column: update.column, sortOrder: update.sortOrder },
      });
    }

    return derive(await loadTasks(tx, boardId), await loadEdges(tx, boardId));
  });
}

export async function deleteTask(
  id: string,
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  const existing = await db.task.findUnique({ where: { id: storedId(boardId, id) } });
  if (!existing || existing.boardId !== boardId) {
    throw new BoardError(404, "NOT_FOUND", `Task ${id} was not found.`);
  }
  await db.task.delete({ where: { id: storedId(boardId, id) } });
  return getBoard(boardId, db);
}

export async function resetBoard(boardId = LOCAL_BOARD, db: PrismaClient = prisma): Promise<BoardPayload> {
  assertBoardId(boardId);
  try {
    await db.$transaction(async (tx) => {
      await tx.dependency.deleteMany({ where: { boardId } });
      await tx.task.deleteMany({ where: { boardId } });
      for (const task of SEED_TASKS) {
        await tx.task.create({
          data: {
            id: storedId(boardId, task.id),
            boardId,
            logicalId: task.id,
            title: task.title,
            description: task.description,
            column: task.column,
            sortOrder: task.sortOrder,
            plannedStart: task.plannedStart,
            durationDays: task.durationDays,
          },
        });
      }
      for (const edge of SEED_EDGES) {
        await tx.dependency.create({
          data: {
            boardId,
            predecessorId: storedId(boardId, edge.predecessorId),
            successorId: storedId(boardId, edge.successorId),
          },
        });
      }
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
  }
  return getBoard(boardId, db);
}

export async function previewNewDependency(
  predecessorId: string,
  successorId: string,
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<PreviewResult> {
  assertBoardId(boardId);
  const tasks = await loadTasks(db, boardId);
  const edges = await loadEdges(db, boardId);
  return previewDependency(tasks, edges, predecessorId, successorId);
}

export async function addDependency(
  predecessorId: string,
  successorId: string,
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  return db.$transaction(async (tx) => {
    const tasks = await loadTasks(tx, boardId);
    const edges = await loadEdges(tx, boardId);
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
      data: {
        boardId,
        predecessorId: storedId(boardId, predecessorId),
        successorId: storedId(boardId, successorId),
      },
    });

    return derive(await loadTasks(tx, boardId), await loadEdges(tx, boardId));
  });
}

export async function removeDependency(
  predecessorId: string,
  successorId: string,
  boardId = LOCAL_BOARD,
  db: PrismaClient = prisma,
): Promise<BoardPayload> {
  assertBoardId(boardId);
  const deleted = await db.dependency.deleteMany({
    where: {
      boardId,
      predecessorId: storedId(boardId, predecessorId),
      successorId: storedId(boardId, successorId),
    },
  });
  if (deleted.count === 0) {
    throw new BoardError(404, "NOT_FOUND", "That dependency was not on the board.");
  }
  return getBoard(boardId, db);
}
