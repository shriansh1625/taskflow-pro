import { describe, expect, it } from "vitest";
import { SEED_EDGES, SEED_TASKS } from "@/seed/board";
import {
  buildCatalog,
  groundProposals,
  heuristicProposals,
  publicModelError,
  suggestionPrompt,
  type RawProposal,
} from "@/server/suggest";

describe("suggestion grounding", () => {
  it("drops unknown ids, self links, existing edges, and cycles", () => {
    const raw: RawProposal[] = [
      {
        predecessorId: "ghost",
        successorId: "api",
        reason: "invented",
        confidence: 0.9,
      },
      {
        predecessorId: "schema",
        successorId: "schema",
        reason: "self",
        confidence: 0.9,
      },
      {
        predecessorId: "schema",
        successorId: "api",
        reason: "already there",
        confidence: 0.9,
      },
      {
        predecessorId: "integration",
        successorId: "schema",
        reason: "cycle",
        confidence: 0.9,
      },
      {
        predecessorId: "ui-shell",
        successorId: "release",
        reason: "shell before release",
        confidence: 0.4,
      },
    ];
    const { kept, dropped } = groundProposals(SEED_TASKS, SEED_EDGES, raw, "model");
    expect(dropped.length).toBe(4);
    expect(kept.every((item) => item.predecessorId !== "ghost")).toBe(true);
    expect(kept.some((item) => item.predecessorId === "ui-shell" && item.successorId === "release")).toBe(
      true,
    );
  });

  it("sorts survivors by days moved, not confidence", () => {
    const raw: RawProposal[] = [
      {
        predecessorId: "auth-design",
        successorId: "client",
        reason: "weak overlap",
        confidence: 0.99,
      },
      {
        predecessorId: "schema",
        successorId: "ui-shell",
        reason: "schema before shell",
        confidence: 0.1,
      },
    ];
    const { kept } = groundProposals(SEED_TASKS, SEED_EDGES, raw, "model");
    expect(kept.length).toBeGreaterThan(0);
    for (let index = 1; index < kept.length; index += 1) {
      expect(kept[index - 1].totalDaysMoved).toBeGreaterThanOrEqual(kept[index].totalDaysMoved);
    }
  });

  it("never writes; heuristics skip edges that already exist", () => {
    const proposals = heuristicProposals(SEED_TASKS, SEED_EDGES);
    const existing = new Set(SEED_EDGES.map((edge) => `${edge.predecessorId}->${edge.successorId}`));
    expect(proposals.every((item) => !existing.has(`${item.predecessorId}->${item.successorId}`))).toBe(
      true,
    );
    expect(proposals.every((item) => item.predecessorId !== item.successorId)).toBe(true);
  });

  it("prompt only includes catalog ids", () => {
    const prompt = suggestionPrompt({
      tasks: [
        {
          id: "schema",
          title: "Database schema",
          description: "tables",
          column: "DONE",
          plannedStart: "2026-09-01",
          durationDays: 4,
        },
      ],
      edges: [],
    });
    expect(prompt).toContain("schema");
    expect(prompt).toContain("untrusted");
    expect(prompt).not.toContain("ignore previous");
  });

  it("catalog sends stored dates, not derived finishes", () => {
    const catalog = buildCatalog(SEED_TASKS, SEED_EDGES);
    expect(catalog.tasks[0]).toHaveProperty("plannedStart");
    expect(catalog.tasks[0]).toHaveProperty("durationDays");
    expect(JSON.stringify(catalog)).not.toContain("effectiveFinish");
    expect(JSON.stringify(catalog)).not.toContain("onCriticalPath");
  });

  it("never forwards provider error bodies to the browser", () => {
    expect(publicModelError(new Error("Model HTTP 401: invalid api key gsk_secret"))).toBe(
      "The model endpoint rejected the request.",
    );
    expect(publicModelError(new Error("GROQ_API_KEY is not set."))).toBe("GROQ_API_KEY is not set.");
  });
});
