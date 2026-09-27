import { describe, expect, it } from "vitest";
import { explainCriticalPath, explainTask, recompute } from "@/engine";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";

describe("explanations", () => {
  it("states binding, readiness, and that planned dates stay stored", () => {
    const result = recompute(SEED_TASKS, SEED_EDGES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const titles = new Map(result.tasks.map((task) => [task.id, task.title]));
    const integration = result.tasks.find((task) => task.id === "integration")!;
    const text = explainTask(integration, titles);
    expect(text).toContain("Integration tests");
    expect(text).toContain("Blocked");
    expect(text).toContain("derived");
    expect(text).not.toContain(integration.plannedStart + " was rewritten");
    expect(explainCriticalPath(result.tasks)).toContain("Critical path");
  });
});
