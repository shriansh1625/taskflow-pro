import { isIsoDate } from "./dates";
import { COLUMNS, type Column } from "./types";

export function parseColumn(value: unknown): Column | null {
  return typeof value === "string" && (COLUMNS as readonly string[]).includes(value)
    ? (value as Column)
    : null;
}

export function invalidTaskFields(input: {
  title?: string;
  plannedStart?: string;
  durationDays?: number;
}): string | null {
  if (input.title !== undefined && input.title.trim().length === 0) {
    return "Title is required.";
  }
  if (input.durationDays !== undefined) {
    if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
      return "Duration must be a whole number of days, at least 1.";
    }
  }
  if (input.plannedStart !== undefined && !isIsoDate(input.plannedStart)) {
    return "Planned start must be a calendar date as YYYY-MM-DD.";
  }
  return null;
}
