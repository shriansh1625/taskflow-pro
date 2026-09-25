import { COLUMNS } from "@/engine";
import { createTask } from "@/server/board-store";
import { jsonBoard, jsonError, jsonFail } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.title || !body?.plannedStart || body?.durationDays === undefined) {
      return jsonFail("title, plannedStart, and durationDays are required.");
    }
    const column = body.column;
    if (column !== undefined && !COLUMNS.includes(column)) {
      return jsonFail("column must be a valid board column.");
    }
    return jsonBoard(
      await createTask({
        title: String(body.title),
        description: body.description ? String(body.description) : "",
        column,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
        plannedStart: String(body.plannedStart),
        durationDays: Number(body.durationDays),
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
