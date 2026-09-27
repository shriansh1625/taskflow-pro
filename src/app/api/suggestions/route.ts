import { storedTasks } from "@/engine";
import { getBoard } from "@/server/board-store";
import { jsonBoard, jsonFail, runRoute } from "@/server/http";
import { rateLimit } from "@/server/limit";
import { suggestDependencies } from "@/server/suggest";

export function POST() {
  return runRoute(async () => {
    if (!rateLimit("suggest")) {
      return jsonFail("Too many suggestion requests. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const board = await getBoard();
    return jsonBoard(await suggestDependencies(storedTasks(board.tasks), board.edges));
  });
}
