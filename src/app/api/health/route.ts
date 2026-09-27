import { getBoard } from "@/server/board-store";
import { jsonBoard, runRoute } from "@/server/http";

export function GET() {
  return runRoute(async () => {
    try {
      const board = await getBoard();
      const projectFinish = board.tasks.reduce(
        (latest, task) => (task.effectiveFinish > latest ? task.effectiveFinish : latest),
        "0000-01-01",
      );
      return jsonBoard({
        ok: true,
        tasks: board.tasks.length,
        edges: board.edges.length,
        projectFinish: projectFinish === "0000-01-01" ? null : projectFinish,
        suggestions: process.env.GROQ_API_KEY ? "model" : "heuristic",
      });
    } catch {
      return jsonBoard({ ok: false, error: "Board store unavailable." }, 503);
    }
  });
}
