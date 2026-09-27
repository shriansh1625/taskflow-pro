import { addDependency, removeDependency } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";

export function POST(request: Request) {
  return runRoute(async () => {
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(await addDependency(String(body.predecessorId), String(body.successorId)));
  });
}

export function DELETE(request: Request) {
  return runRoute(async () => {
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(await removeDependency(String(body.predecessorId), String(body.successorId)));
  });
}
