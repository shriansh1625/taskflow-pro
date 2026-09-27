import type { DerivedTask } from "./types";

function nameOf(id: string, titles: Map<string, string>): string {
  return titles.get(id) ?? id;
}

/** Facts only. No model. Planned dates are never rewritten here. */
export function explainTask(task: DerivedTask, titles: Map<string, string>): string {
  const held = task.bindingPredecessorId
    ? `It is held by ${nameOf(task.bindingPredecessorId, titles)}.`
    : "It is held by its own planned start.";
  const start =
    task.effectiveStart === task.plannedStart
      ? `Effective start matches the stored planned start ${task.plannedStart}.`
      : `Effective start ${task.effectiveStart} is later than the stored planned start ${task.plannedStart}.`;
  const readiness =
    task.readiness === "BLOCKED"
      ? `It is Blocked by ${task.unmetPredecessorIds.map((id) => nameOf(id, titles)).join(", ")}.`
      : "It is Ready.";
  const path = task.onCriticalPath
    ? "Slack is 0, so it is on the critical path."
    : `Slack is ${task.slackDays} day${task.slackDays === 1 ? "" : "s"}.`;
  return [
    `${task.title} finishes ${task.effectiveFinish} after ${task.durationDays} stored day${task.durationDays === 1 ? "" : "s"}.`,
    start,
    held,
    readiness,
    path,
    "Only planned start and duration are stored. This finish was derived.",
  ].join(" ");
}

export function explainCriticalPath(tasks: DerivedTask[]): string {
  const chain = tasks
    .filter((task) => task.onCriticalPath)
    .sort((left, right) => left.effectiveFinish.localeCompare(right.effectiveFinish) || left.title.localeCompare(right.title));
  if (chain.length === 0) return "No task has zero slack.";
  const finish = chain.reduce(
    (latest, task) => (task.effectiveFinish > latest ? task.effectiveFinish : latest),
    chain[0].effectiveFinish,
  );
  return `Zero slack (${chain.length}): ${chain.map((task) => task.title).join(", ")}. Latest of those finishes is ${finish}. Zero slack is not one dependency chain.`;
}

const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

/** A rewrite may only restate the fact sheet. Arrows and new dates are rejected. */
export function acceptRewrite(facts: string, text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 40 || cleaned.length > 480) return false;
  if (/→|->|=>|```/.test(cleaned)) return false;
  const allowed = new Set(facts.match(ISO_DATE) ?? []);
  const used = cleaned.match(ISO_DATE) ?? [];
  if (used.some((date) => !allowed.has(date))) return false;
  const sentences = cleaned.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  return sentences.length > 0 && sentences.length <= 3;
}

export function deliveryImpact(tasks: DerivedTask[]): {
  blocked: number;
  held: number;
  ownStart: number;
  zeroSlack: number;
  projectFinish: string | null;
} {
  const projectFinish = tasks.reduce<string | null>(
    (latest, task) => (latest === null || task.effectiveFinish > latest ? task.effectiveFinish : latest),
    null,
  );
  return {
    blocked: tasks.filter((task) => task.readiness === "BLOCKED").length,
    held: tasks.filter((task) => task.bindingPredecessorId !== null).length,
    ownStart: tasks.filter((task) => task.bindingPredecessorId === null).length,
    zeroSlack: tasks.filter((task) => task.onCriticalPath).length,
    projectFinish,
  };
}
