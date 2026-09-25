import { BoardApp } from "@/components/BoardApp";
import { getBoard } from "@/server/board-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const board = await getBoard();
    return <BoardApp initialBoard={board} />;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The board could not be loaded.";
    return (
      <main className="empty-board">
        <h1>TaskFlow Pro</h1>
        <p>{message}</p>
        <p>
          Run <code>npm run db:push</code> and <code>npm run db:seed</code>, then refresh.
        </p>
      </main>
    );
  }
}
