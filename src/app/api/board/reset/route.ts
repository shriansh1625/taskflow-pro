import { resetBoard } from "@/server/board-store";
import { jsonBoard, jsonFail, runRoute } from "@/server/http";
import { rateLimit } from "@/server/limit";

export function POST() {
  return runRoute(async () => {
    if (!rateLimit("reset", 4)) {
      return jsonFail("Too many resets. Try again in a minute.", 429, "RATE_LIMIT");
    }
    return jsonBoard(await resetBoard());
  });
}
