import { PrismaClient } from "@prisma/client";
import { SEED_EDGES, SEED_TASKS } from "../src/seed/board";

const prisma = new PrismaClient();

async function main() {
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();

  for (const task of SEED_TASKS) {
    await prisma.task.create({
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        column: task.column,
        sortOrder: task.sortOrder,
        plannedStart: task.plannedStart,
        durationDays: task.durationDays,
      },
    });
  }

  for (const edge of SEED_EDGES) {
    await prisma.dependency.create({ data: edge });
  }

  console.log(`Seeded ${SEED_TASKS.length} tasks and ${SEED_EDGES.length} dependencies.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
