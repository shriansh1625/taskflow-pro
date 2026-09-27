import { previewNewDependency } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";

export function POST(request: Request) {
  return runRoute(async () => {
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(
      await previewNewDependency(String(body.predecessorId), String(body.successorId)),
    );
  });
}
