import { getBoard } from "@/server/board-store";
import { explainBoard } from "@/server/explain";
import { jsonBoard, jsonError, readJson } from "@/server/http";
import { rateLimit } from "@/server/limit";

export async function POST(request: Request) {
  try {
    if (!rateLimit("explain", 8)) {
      return jsonBoard({ error: "Too many explanation requests. Try again in a minute.", code: "RATE_LIMIT" }, 429);
    }
    const body = (await readJson(request)) as { taskId?: unknown };
    const taskId = typeof body.taskId === "string" && body.taskId ? body.taskId : undefined;
    const board = await getBoard();
    return jsonBoard(await explainBoard(board.tasks, taskId));
  } catch (error) {
    return jsonError(error);
  }
}
