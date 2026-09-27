import { storedTasks } from "@/engine";
import { getBoard } from "@/server/board-store";
import { jsonBoard, jsonFail, runRoute } from "@/server/http";
import { consumeLimit } from "@/server/limit";
import { boardContext } from "@/server/session";
import { suggestDependencies } from "@/server/suggest";

export function POST() {
  return runRoute(async () => {
    const { boardId } = await boardContext();
    if (!(await consumeLimit(boardId, "suggest", 8))) {
      return jsonFail("Too many suggestion requests. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const board = await getBoard(boardId);
    return jsonBoard(await suggestDependencies(storedTasks(board.tasks), board.edges));
  });
}
