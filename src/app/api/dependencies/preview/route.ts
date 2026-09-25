import { previewNewDependency } from "@/server/board-store";
import { jsonBoard, jsonError, jsonFail, readJson } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(
      await previewNewDependency(String(body.predecessorId), String(body.successorId)),
    );
  } catch (error) {
    return jsonError(error);
  }
}
