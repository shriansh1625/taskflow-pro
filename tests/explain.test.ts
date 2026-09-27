import { describe, expect, it } from "vitest";
import { acceptRewrite, deliveryImpact, explainCriticalPath, explainTask, recompute } from "@/engine";
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
    const path = explainCriticalPath(result.tasks);
    expect(path).toContain("Zero slack");
    expect(path).not.toContain("→");
    const impact = deliveryImpact(result.tasks);
    expect(impact.blocked).toBeGreaterThan(0);
    expect(impact.held + impact.ownStart).toBe(result.tasks.length);
    expect(impact.plannedFinish).toBe("2026-09-07");
    expect(impact.projectFinish).toBe("2026-09-13");
    expect(impact.slipDays).toBe(6);
    const slipped = recompute(
      SEED_TASKS.map((task) =>
        task.id === "schema" ? { ...task, durationDays: task.durationDays + 3 } : task,
      ),
      SEED_EDGES,
    );
    expect(slipped.ok).toBe(true);
    if (!slipped.ok) return;
    expect(deliveryImpact(slipped.tasks).slipDays).toBe(8);
  });

  it("rejects a rewrite that invents a chain, a date, or a merged held-by", () => {
    const facts =
      "Integration tests finishes 2026-09-12. It is held by Backend API. It is Blocked by Backend API, Data migration. Zero slack is not one dependency chain.";
    const faithful =
      "Integration tests finishes 2026-09-12. It is held by Backend API. It is Blocked by Backend API, Data migration.";
    expect(acceptRewrite(facts, faithful)).toBe(true);
    expect(acceptRewrite(facts, "Schema → API → Integration tests finishes 2026-09-12. It is held by Backend API. It is Blocked by Backend API.")).toBe(false);
    expect(acceptRewrite(facts, "Integration tests finishes 2026-10-01. It is held by Backend API. It is Blocked by Backend API, Data migration.")).toBe(false);
    expect(
      acceptRewrite(
        facts,
        "Integration tests finishes 2026\u201109\u201110. It is held by Backend API. It is Blocked by Backend API, Data migration.",
      ),
    ).toBe(false);
    expect(
      acceptRewrite(
        facts,
        "Integration tests finishes 2026\u201109\u201112. It is held by Backend API. It is Blocked by Backend API and Data migration.",
      ),
    ).toBe(true);
    expect(
      acceptRewrite(
        facts,
        "Integration tests finishes 2026-09-12. It is held and blocked by Backend API and also blocked by Data migration.",
      ),
    ).toBe(false);
    expect(
      acceptRewrite(
        facts,
        "Integration tests finishes 2026-09-12. It is held by Data migration. It is Blocked by Backend API, Data migration.",
      ),
    ).toBe(false);
  });
});
