import { addDependency, removeDependency } from "@/server/board-store";
import { jsonBoard, jsonError, jsonFail } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(
      await addDependency(String(body.predecessorId), String(body.successorId)),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (!body?.predecessorId || !body?.successorId) {
      return jsonFail("predecessorId and successorId are required.");
    }
    return jsonBoard(
      await removeDependency(String(body.predecessorId), String(body.successorId)),
    );
  } catch (error) {
    return jsonError(error);
  }
}
