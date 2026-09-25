import { deleteTask, updateTask } from "@/server/board-store";
import { jsonBoard, jsonError, readJson } from "@/server/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await readJson(request)) as {
      title?: unknown;
      description?: unknown;
      plannedStart?: unknown;
      durationDays?: unknown;
    };
    return jsonBoard(
      await updateTask(id, {
        title: body.title !== undefined ? String(body.title) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        plannedStart:
          body.plannedStart !== undefined ? String(body.plannedStart) : undefined,
        durationDays:
          body.durationDays !== undefined ? Number(body.durationDays) : undefined,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return jsonBoard(await deleteTask(id));
  } catch (error) {
    return jsonError(error);
  }
}
