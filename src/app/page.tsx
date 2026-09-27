import { BoardApp } from "@/components/BoardApp";
import { openBoard } from "@/server/board-store";
import { boardContext } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const { boardId, actorKey } = await boardContext();
    const board = await openBoard(boardId, actorKey);
    return <BoardApp initialBoard={board} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The board could not be loaded.";
    return (
      <main className="empty-board">
        <h1>TaskFlow Pro</h1>
        <p>{message}</p>
        <p>
          Run <code>npm run db:push</code> and refresh.
        </p>
      </main>
    );
  }
}
