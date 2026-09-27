import { resetBoard } from "@/server/board-store";
import { jsonBoard, jsonFail, runRoute } from "@/server/http";
import { consumeLimit } from "@/server/limit";
import { boardContext } from "@/server/session";

export function POST() {
  return runRoute(async () => {
    const { boardId } = await boardContext();
    if (!(await consumeLimit(boardId, "reset", 4))) {
      return jsonFail("Too many resets. Try again in a minute.", 429, "RATE_LIMIT");
    }
    return jsonBoard(await resetBoard(boardId));
  });
}
