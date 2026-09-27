import { previewNewDependency } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";
import { consumeLimit } from "@/server/limit";
import { boardContext } from "@/server/session";

export function POST(request: Request) {
  return runRoute(async () => {
    const { boardId } = await boardContext();
    if (!(await consumeLimit(boardId, "preview", 40))) {
      return jsonFail("Too many previews. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(
      await previewNewDependency(String(body.predecessorId), String(body.successorId), boardId),
    );
  });
}
