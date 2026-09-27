import { prisma } from "@/server/db";
import { jsonBoard, runRoute } from "@/server/http";

export function GET() {
  return runRoute(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const boards = await prisma.task.findMany({
        distinct: ["boardId"],
        select: { boardId: true },
      });
      return jsonBoard({
        ok: true,
        isolation: "per-browser",
        rateLimits: "database",
        boards: boards.length,
        suggestions: process.env.GROQ_API_KEY ? "model" : "heuristic",
      });
    } catch {
      return jsonBoard({ ok: false, error: "Board store unavailable." }, 503);
    }
  });
}
