import type { Column } from "@/engine";

export const COLUMN_COPY: Record<Column, { index: string; title: string; hint: string }> = {
  BACKLOG: { index: "01", title: "Backlog", hint: "not started" },
  IN_PROGRESS: { index: "02", title: "In progress", hint: "active" },
  REVIEW: { index: "03", title: "Review", hint: "in judgment" },
  DONE: { index: "04", title: "Done", hint: "satisfies later work" },
};

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
