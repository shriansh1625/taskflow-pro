import type { DependencyEdge, TaskInput } from "@/engine";

/**
 * Nine delivery tasks. The diamond is schema -> api and schema -> migration,
 * both into integration tests. Extending schema by 3 days moves integration
 * tests by 3 days, because the API path is the later one.
 */
export const SEED_TASKS: TaskInput[] = [
  {
    id: "schema",
    title: "Database schema",
    description: "Tables for tasks, dependencies, and planned dates.",
    column: "DONE",
    sortOrder: 0,
    plannedStart: "2026-09-01",
    durationDays: 4,
  },
  {
    id: "api",
    title: "Backend API",
    description: "Task and dependency endpoints that persist the board.",
    column: "IN_PROGRESS",
    sortOrder: 0,
    plannedStart: "2026-09-01",
    durationDays: 5,
  },
  {
    id: "migration",
    title: "Data migration",
    description: "Load the existing board into the new schema.",
    column: "BACKLOG",
    sortOrder: 0,
    plannedStart: "2026-09-01",
    durationDays: 3,
  },
  {
    id: "integration",
    title: "Integration tests",
    description: "Cycle, diamond, chain, and regression checks against the API.",
    column: "BACKLOG",
    sortOrder: 1,
    plannedStart: "2026-09-01",
    durationDays: 2,
  },
  {
    id: "auth-design",
    title: "Auth model",
    description: "Decide how a single editor signs in for this board.",
    column: "DONE",
    sortOrder: 1,
    plannedStart: "2026-09-01",
    durationDays: 2,
  },
  {
    id: "auth-api",
    title: "Auth endpoints",
    description: "Session checks for board writes.",
    column: "BACKLOG",
    sortOrder: 2,
    plannedStart: "2026-09-02",
    durationDays: 3,
  },
  {
    id: "ui-shell",
    title: "App shell",
    description: "Four Kanban columns and the task form.",
    column: "IN_PROGRESS",
    sortOrder: 1,
    plannedStart: "2026-09-03",
    durationDays: 3,
  },
  {
    id: "client",
    title: "API client",
    description: "Board calls used by drag and drop.",
    column: "BACKLOG",
    sortOrder: 3,
    plannedStart: "2026-09-04",
    durationDays: 2,
  },
  {
    id: "release",
    title: "Release checklist",
    description: "Confirm the seeded diamond, docs, and AI declaration.",
    column: "BACKLOG",
    sortOrder: 4,
    plannedStart: "2026-09-06",
    durationDays: 1,
  },
];

export const SEED_EDGES: DependencyEdge[] = [
  { predecessorId: "schema", successorId: "api" },
  { predecessorId: "schema", successorId: "migration" },
  { predecessorId: "api", successorId: "integration" },
  { predecessorId: "migration", successorId: "integration" },
  { predecessorId: "schema", successorId: "auth-api" },
  { predecessorId: "auth-design", successorId: "auth-api" },
  { predecessorId: "api", successorId: "client" },
  { predecessorId: "ui-shell", successorId: "client" },
  { predecessorId: "integration", successorId: "release" },
  { predecessorId: "auth-api", successorId: "release" },
  { predecessorId: "client", successorId: "release" },
];
