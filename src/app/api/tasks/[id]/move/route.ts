import { COLUMNS, type Column } from "@/engine";
import { moveTask } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";

type Params = { params: Promise<{ id: string }> };

export function POST(request: Request, { params }: Params) {
  return runRoute(async () => {
    const { id } = await params;
    const body = (await readJson(request)) as { column?: unknown; sortOrder?: unknown };
    if (!body?.column || !COLUMNS.includes(body.column as Column)) {
      return jsonFail("column must be a valid board column.");
    }
    if (typeof body.sortOrder !== "number") {
      return jsonFail("sortOrder must be a number.");
    }
    return jsonBoard(await moveTask(id, body.column as Column, body.sortOrder));
  });
}
