import { resetBoard } from "@/server/board-store";
import { jsonBoard, jsonError, jsonFail } from "@/server/http";
import { rateLimit } from "@/server/limit";

export async function POST() {
  try {
    if (!rateLimit("reset", 4)) {
      return jsonFail("Too many resets. Try again in a minute.", 429, "RATE_LIMIT");
    }
    return jsonBoard(await resetBoard());
  } catch (error) {
    return jsonError(error);
  }
}
