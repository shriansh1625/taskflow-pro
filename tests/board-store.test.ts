import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addDependency,
  deleteTask,
  getBoard,
  moveTask,
  NEW_BOARD_LIMIT,
  openBoard,
  previewNewDependency,
  removeDependency,
  resetBoard,
  updateTask,
} from "@/server/board-store";
import { prisma } from "@/server/db";
import { consumeLimit } from "@/server/limit";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";

const testDbPath = path.join(process.cwd(), ".test-board.db");

beforeAll(async () => {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
  });
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

  it("runs the judge walkthrough without compounding the diamond", async () => {
    const seeded = await resetBoard();
    const beforeFinish = seeded.tasks.find((task) => task.id === "integration")!.effectiveFinish;
    const slipped = await updateTask("schema", { durationDays: 7 });
    const afterFinish = slipped.tasks.find((task) => task.id === "integration")!.effectiveFinish;
    expect(Date.parse(`${afterFinish}T00:00:00Z`) - Date.parse(`${beforeFinish}T00:00:00Z`)).toBe(
      3 * 86_400_000,
    );
    const again = await updateTask("schema", { durationDays: 7 });
    expect(again.tasks.find((task) => task.id === "integration")!.effectiveFinish).toBe(afterFinish);
    expect(again.tasks.find((task) => task.id === "schema")!.plannedStart).toBe("2026-09-01");

    await expect(moveTask("integration", "IN_PROGRESS", 0)).rejects.toMatchObject({ code: "BLOCKED" });

    const regressed = await moveTask("schema", "IN_PROGRESS", 0);
    expect(regressed.tasks.find((task) => task.id === "schema")!.column).toBe("IN_PROGRESS");
    expect(regressed.tasks.find((task) => task.id === "api")).toMatchObject({
      column: "IN_PROGRESS",
      readiness: "BLOCKED",
    });

    const preview = await previewNewDependency("integration", "schema");
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.code).toBe("CYCLE");
  });

  it("deletes a task and its edges then recomputes", async () => {
    const after = await deleteTask("release");
    expect(after.tasks.find((task) => task.id === "release")).toBeUndefined();
    expect(after.edges.every((edge) => edge.predecessorId !== "release" && edge.successorId !== "release")).toBe(
      true,
    );
    expect(after.tasks).toHaveLength(8);
  });

  it("reseeds an empty database so a fresh host is usable", async () => {
    await prisma.dependency.deleteMany();
    await prisma.task.deleteMany();
    const board = await openBoard("local", "fresh-host");
    expect(board.tasks).toHaveLength(9);
  });

  it("keeps one browser's reset off another browser's board", async () => {
    await resetBoard("alpha");
    await resetBoard("beta");
    await updateTask("schema", { durationDays: 9 }, "alpha");
    const beta = await getBoard("beta");
    expect(beta.tasks.find((task) => task.id === "schema")?.durationDays).toBe(4);
    await resetBoard("alpha");
    const betaAfter = await getBoard("beta");
    expect(betaAfter.tasks.find((task) => task.id === "schema")?.durationDays).toBe(4);
    expect(betaAfter.tasks).toHaveLength(9);
  });

  it("stores write limits in the database and caps new boards per network", async () => {
    expect(await consumeLimit("board-a", "mutate", 2)).toBe(true);
    expect(await consumeLimit("board-a", "mutate", 2)).toBe(true);
    expect(await consumeLimit("board-a", "mutate", 2)).toBe(false);
    expect(await consumeLimit("board-b", "mutate", 2)).toBe(true);
    await prisma.rateBucket.update({
      where: { id: "board-a:mutate" },
      data: { windowStart: new Date(Date.now() - 120_000) },
    });
    expect(await consumeLimit("board-a", "mutate", 2)).toBe(true);

    const actor = "same-network";
    for (let i = 0; i < NEW_BOARD_LIMIT; i += 1) {
      expect(await consumeLimit(`actor:${actor}`, "create-board", NEW_BOARD_LIMIT)).toBe(true);
    }
    await expect(openBoard("capped-board", actor)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMIT",
    });
    expect(await prisma.task.count({ where: { boardId: "capped-board" } })).toBe(0);
  });
});
