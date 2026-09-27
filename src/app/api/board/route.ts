import { getBoard } from "@/server/board-store";
import { jsonBoard, runRoute } from "@/server/http";

export function GET() {
  return runRoute(async () => jsonBoard(await getBoard()));
}
