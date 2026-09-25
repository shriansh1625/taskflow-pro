import { getBoard } from "@/server/board-store";
import { jsonBoard, jsonError } from "@/server/http";

export async function GET() {
  try {
    return jsonBoard(await getBoard());
  } catch (error) {
    return jsonError(error);
  }
}
