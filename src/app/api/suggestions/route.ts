import { getBoard } from "@/server/board-store";
import { jsonBoard, jsonError, jsonFail } from "@/server/http";
import { rateLimit } from "@/server/limit";
import { suggestDependencies } from "@/server/suggest";

export async function POST() {
  try {
    if (!rateLimit("suggest")) {
      return jsonFail("Too many suggestion requests. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const board = await getBoard();
    const tasks = board.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      column: task.column,
      sortOrder: task.sortOrder,
      plannedStart: task.plannedStart,
      durationDays: task.durationDays,
    }));
    return jsonBoard(await suggestDependencies(tasks, board.edges));
  } catch (error) {
    return jsonError(error);
  }
}
