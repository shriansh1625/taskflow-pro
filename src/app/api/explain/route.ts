import { getBoard } from "@/server/board-store";
import { explainBoard } from "@/server/explain";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";
import { rateLimit } from "@/server/limit";

export function POST(request: Request) {
  return runRoute(async () => {
    if (!rateLimit("explain", 8)) {
      return jsonFail("Too many explanation requests. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const body = (await readJson(request)) as { taskId?: unknown };
    const taskId = typeof body.taskId === "string" && body.taskId ? body.taskId : undefined;
    const board = await getBoard();
    return jsonBoard(await explainBoard(board.tasks, taskId));
  });
}
