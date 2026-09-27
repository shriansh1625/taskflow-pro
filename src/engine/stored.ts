import type { DerivedTask, TaskInput } from "./types";

/** Drop derived fields before anything is stored or sent to a model. */
export function storedTasks(tasks: DerivedTask[]): TaskInput[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    column: task.column,
    sortOrder: task.sortOrder,
    plannedStart: task.plannedStart,
    durationDays: task.durationDays,
  }));
}
