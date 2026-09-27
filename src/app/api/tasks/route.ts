import { COLUMNS, type Column } from "@/engine";
import { createTask } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";
import { allowWrite } from "@/server/limit";

export function POST(request: Request) {
  return runRoute(async () => {
    if (!allowWrite()) return jsonFail("Too many writes. Try again in a minute.", 429, "RATE_LIMIT");
    const body = (await readJson(request)) as {
      title?: unknown;
      plannedStart?: unknown;
      durationDays?: unknown;
      description?: unknown;
      column?: unknown;
      sortOrder?: unknown;
    };
    if (!body?.title || !body?.plannedStart || body?.durationDays === undefined) {
      return jsonFail("title, plannedStart, and durationDays are required.");
    }
    const column = body.column;
    if (column !== undefined && !COLUMNS.includes(column as Column)) {
      return jsonFail("column must be a valid board column.");
    }
    return jsonBoard(
      await createTask({
        title: String(body.title),
        description: body.description ? String(body.description) : "",
        column: column as Column | undefined,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
        plannedStart: String(body.plannedStart),
        durationDays: Number(body.durationDays),
      }),
    );
  });
}
