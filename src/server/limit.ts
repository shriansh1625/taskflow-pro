import { prisma } from "./db";

/**
 * Fixed one-minute window stored in the database.
 * A new serverless instance reads the same row, so the count survives a cold start.
 */
export async function consumeLimit(scope: string, bucket: string, max: number): Promise<boolean> {
  const id = `${scope}:${bucket}`;
  const now = new Date();
  const freshAfter = now.getTime() - 60_000;

  return prisma.$transaction(async (tx) => {
    const row = await tx.rateBucket.findUnique({ where: { id } });
    if (!row || row.windowStart.getTime() <= freshAfter) {
      await tx.rateBucket.upsert({
        where: { id },
        create: { id, windowStart: now, count: 1 },
        update: { windowStart: now, count: 1 },
      });
      return true;
    }
    if (row.count >= max) return false;
    await tx.rateBucket.update({
      where: { id },
      data: { count: { increment: 1 } },
    });
    return true;
  });
}

export function allowWrite(boardId: string): Promise<boolean> {
  return consumeLimit(boardId, "mutate", 40);
}
