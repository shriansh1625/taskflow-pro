import { getBoard } from "@/server/board-store";
import { jsonBoard } from "@/server/http";

export async function GET() {
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
}
