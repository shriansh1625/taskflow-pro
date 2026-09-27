import { addDependency, removeDependency } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";
import { allowWrite } from "@/server/limit";

export function POST(request: Request) {
  return runRoute(async () => {
    if (!allowWrite()) return jsonFail("Too many writes. Try again in a minute.", 429, "RATE_LIMIT");
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(await addDependency(String(body.predecessorId), String(body.successorId)));
  });
}

export function DELETE(request: Request) {
  return runRoute(async () => {
    if (!allowWrite()) return jsonFail("Too many writes. Try again in a minute.", 429, "RATE_LIMIT");
    const body = (await readJson(request)) as { predecessorId?: unknown; successorId?: unknown };
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(await removeDependency(String(body.predecessorId), String(body.successorId)));
  });
}
