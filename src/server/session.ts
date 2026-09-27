import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { BoardError } from "./board-store";

/** Set by middleware from the httpOnly cookie. Callers cannot pick another board. */
export async function boardContext(): Promise<{ boardId: string; actorKey: string }> {
  const headerStore = await headers();
  const boardId = headerStore.get("x-board-id") ?? "";
  if (!/^[a-f0-9]{32}$/.test(boardId)) {
    throw new BoardError(400, "NO_BOARD", "Missing board session. Refresh the page.");
  }
  const forwarded = headerStore.get("x-real-ip") || headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const actorKey = createHash("sha256").update(forwarded).digest("hex").slice(0, 24);
  return { boardId, actorKey };
}
