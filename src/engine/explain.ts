import { addDays, diffDays } from "./dates";
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
const FANCY_DASH = /[\u2010\u2011\u2012\u2013\u2014\u2212\uFE58\uFF0D]/g;

/** Turn unicode dashes into the hyphen the date check understands. */
export function normalizeForCheck(text: string): string {
  return text.replace(FANCY_DASH, "-").replace(/\u00a0/g, " ").trim();
}

function phraseAfter(text: string, label: string): string | null {
  const match = text.match(new RegExp(`${label}\\s+([^.?!]+)`, "i"));
  if (!match) return null;
  return match[1].replace(/\s+/g, " ").trim().toLowerCase();
}

function nameList(phrase: string | null): string[] {
  if (!phrase) return [];
  return phrase
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((part) => part.replace(/[^a-z0-9 ]/gi, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * A rewrite may only restate the fact sheet.
 * Held-by (the date) and blocked-by (readiness) must stay the engine's names.
 * A date is checked after unicode dashes are folded into ASCII hyphens.
 */
export function acceptRewrite(facts: string, text: string): boolean {
  const cleaned = normalizeForCheck(text);
  const sheet = normalizeForCheck(facts);
  if (cleaned.length < 40 || cleaned.length > 480) return false;
  if (/[→←⇒]|->|=>|```|held and blocked/i.test(cleaned)) return false;

  const allowed = new Set(sheet.match(ISO_DATE) ?? []);
  const used = cleaned.match(ISO_DATE) ?? [];
  if (used.some((date) => !allowed.has(date))) return false;
  const finish = sheet.match(/finishes (\d{4}-\d{2}-\d{2})/);
  if (finish && !cleaned.includes(finish[1])) return false;

  const factHeld = phraseAfter(sheet, "held by");
  const rewriteHeld = phraseAfter(cleaned, "held by");
  if (factHeld && rewriteHeld !== factHeld) return false;

  const factBlocked = new Set(nameList(phraseAfter(sheet, "blocked by")));
  const rewriteBlocked = nameList(phraseAfter(cleaned, "blocked by"));
  if (factBlocked.size > 0 && rewriteBlocked.length === 0) return false;
  if (rewriteBlocked.some((name) => !factBlocked.has(name))) return false;
  if (factBlocked.size === 0 && rewriteBlocked.length > 0) return false;

  const sentences = cleaned.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  return sentences.length > 0 && sentences.length <= 3;
}

export function deliveryImpact(tasks: DerivedTask[]): {
  blocked: number;
  held: number;
  ownStart: number;
  zeroSlack: number;
  projectFinish: string | null;
  plannedFinish: string | null;
  slipDays: number;
} {
  const projectFinish = tasks.reduce<string | null>(
    (latest, task) => (latest === null || task.effectiveFinish > latest ? task.effectiveFinish : latest),
    null,
  );
  const plannedFinish = tasks.reduce<string | null>((latest, task) => {
    const finish = addDays(task.plannedStart, task.durationDays);
    return latest === null || finish > latest ? finish : latest;
  }, null);
  const slipDays =
    projectFinish && plannedFinish ? Math.max(0, diffDays(projectFinish, plannedFinish)) : 0;
  return {
    blocked: tasks.filter((task) => task.readiness === "BLOCKED").length,
    held: tasks.filter((task) => task.bindingPredecessorId !== null).length,
    ownStart: tasks.filter((task) => task.bindingPredecessorId === null).length,
    zeroSlack: tasks.filter((task) => task.onCriticalPath).length,
    projectFinish,
    plannedFinish,
    slipDays,
  };
}
