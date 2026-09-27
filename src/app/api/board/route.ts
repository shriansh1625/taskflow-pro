import { openBoard } from "@/server/board-store";
import { jsonBoard, runRoute } from "@/server/http";
import { boardContext } from "@/server/session";

export function GET() {
  return runRoute(async () => {
    const { boardId, actorKey } = await boardContext();
    return jsonBoard(await openBoard(boardId, actorKey));
  });
}
