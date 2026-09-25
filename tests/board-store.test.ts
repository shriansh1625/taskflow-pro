import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  addDependency,
  deleteTask,
  getBoard,
  moveTask,
  previewNewDependency,
  removeDependency,
  resetBoard,
  updateTask,
} from "@/server/board-store";
import { prisma } from "@/server/db";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";

const testDbPath = path.join(process.cwd(), ".test-board.db");

beforeAll(async () => {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${testDbPath}` } },
  });
  await prisma.$transaction(async (tx) => {
    for (const task of SEED_TASKS) {
      await tx.task.create({ data: task });
    }
    for (const edge of SEED_EDGES) {
      await tx.dependency.create({ data: edge });
    }
  });
  await prisma.$disconnect();
});

afterAll(async () => {
  await prisma.$disconnect();
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      // Windows may keep the sqlite file open briefly after disconnect.
    }
  }
});

beforeEach(async () => {
  await resetBoard();
});

describe("board store", () => {
  it("returns 9 seeded tasks with derived fields", async () => {
    const board = await getBoard();
    expect(board.tasks).toHaveLength(9);
    expect(board.edges).toHaveLength(SEED_EDGES.length);
    expect(board.tasks.find((task) => task.id === "integration")?.readiness).toBe(
      "BLOCKED",
    );
  });

  it("rejects a cycle inside the dependency transaction", async () => {
    const before = await getBoard();
    await expect(addDependency("integration", "schema")).rejects.toMatchObject({
      code: "CYCLE",
    });
    const after = await getBoard();
    expect(after.edges).toHaveLength(before.edges.length);
  });

  it("refuses a forward move while blocked", async () => {
    await expect(moveTask("integration", "IN_PROGRESS", 0)).rejects.toMatchObject({
      code: "BLOCKED",
    });
  });

  it("previews a cycle without writing an edge", async () => {
    const before = await getBoard();
    const preview = await previewNewDependency("integration", "schema");
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.code).toBe("CYCLE");
    const after = await getBoard();
    expect(after.edges).toHaveLength(before.edges.length);
  });

  it("rejects an invalid duration instead of poisoning the board", async () => {
    await expect(updateTask("schema", { durationDays: 0 })).rejects.toMatchObject({
      code: "INVALID",
    });
    const board = await getBoard();
    expect(board.tasks).toHaveLength(9);
  });

  it("resets to the original seed after a schedule edit", async () => {
    await updateTask("schema", { durationDays: 9 });
    const reset = await resetBoard();
    expect(reset.tasks).toHaveLength(9);
    expect(reset.tasks.find((task) => task.id === "schema")?.durationDays).toBe(4);
  });

  it("persists a duration change and recomputes the diamond once", async () => {
    const before = await getBoard();
    const integrationBefore = before.tasks.find((task) => task.id === "integration")!;
    const after = await updateTask("schema", {
      durationDays: SEED_TASKS.find((task) => task.id === "schema")!.durationDays + 3,
    });
    const integrationAfter = after.tasks.find((task) => task.id === "integration")!;
    const delta =
      Date.parse(`${integrationAfter.effectiveFinish}T00:00:00Z`) -
      Date.parse(`${integrationBefore.effectiveFinish}T00:00:00Z`);
    expect(delta).toBe(3 * 86_400_000);

    const reloaded = await getBoard();
    expect(
      reloaded.tasks.find((task) => task.id === "integration")?.effectiveFinish,
    ).toBe(integrationAfter.effectiveFinish);
  });

  it("rejects a self link and a duplicate without writing", async () => {
    const before = await getBoard();
    await expect(addDependency("schema", "schema")).rejects.toMatchObject({ code: "SELF" });
    await expect(addDependency("schema", "api")).rejects.toMatchObject({ code: "DUPLICATE" });
    const after = await getBoard();
    expect(after.edges).toHaveLength(before.edges.length);
  });

  it("drops a persisted delay when the causing edge is removed", async () => {
    const before = await getBoard();
    const added = await addDependency("schema", "ui-shell");
    const uiAfterAdd = added.tasks.find((task) => task.id === "ui-shell")!;
    const uiBefore = before.tasks.find((task) => task.id === "ui-shell")!;
    expect(uiAfterAdd.effectiveFinish >= uiBefore.effectiveFinish).toBe(true);
    const removed = await removeDependency("schema", "ui-shell");
    expect(removed.tasks.find((task) => task.id === "ui-shell")?.effectiveFinish).toBe(
      uiBefore.effectiveFinish,
    );
  });

  it("deletes a task and its edges then recomputes", async () => {
    const after = await deleteTask("release");
    expect(after.tasks.find((task) => task.id === "release")).toBeUndefined();
    expect(after.edges.every((edge) => edge.predecessorId !== "release" && edge.successorId !== "release")).toBe(
      true,
    );
    expect(after.tasks).toHaveLength(8);
  });
});
