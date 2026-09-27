import { deleteTask, updateTask } from "@/server/board-store";
import { jsonBoard, jsonFail, readJson, runRoute } from "@/server/http";
import { allowWrite } from "@/server/limit";
import { boardContext } from "@/server/session";

type Params = { params: Promise<{ id: string }> };

export function PATCH(request: Request, { params }: Params) {
  return runRoute(async () => {
    const { boardId } = await boardContext();
    if (!(await allowWrite(boardId))) {
      return jsonFail("Too many writes. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const { id } = await params;
    const body = (await readJson(request)) as {
      title?: unknown;
      description?: unknown;
      plannedStart?: unknown;
      durationDays?: unknown;
    };
    return jsonBoard(
      await updateTask(
        id,
        {
          title: body.title !== undefined ? String(body.title) : undefined,
          description: body.description !== undefined ? String(body.description) : undefined,
          plannedStart: body.plannedStart !== undefined ? String(body.plannedStart) : undefined,
          durationDays: body.durationDays !== undefined ? Number(body.durationDays) : undefined,
        },
        boardId,
      ),
    );
  });
}

export function DELETE(_request: Request, { params }: Params) {
  return runRoute(async () => {
    const { boardId } = await boardContext();
    if (!(await allowWrite(boardId))) {
      return jsonFail("Too many writes. Try again in a minute.", 429, "RATE_LIMIT");
    }
    const { id } = await params;
    return jsonBoard(await deleteTask(id, boardId));
  });
}
