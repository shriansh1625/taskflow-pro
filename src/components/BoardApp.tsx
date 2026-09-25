"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { COLUMNS, moveDecision, type BoardPayload, type Column, type DerivedTask } from "@/engine";
import { moveTaskRequest, patchTask, resetBoardRequest, type ApiError } from "@/lib/api";
import { COLUMN_COPY, formatDate } from "@/lib/copy";
import { SEED_TASKS } from "@/seed/board";
import { CreateTaskModal } from "./CreateTaskModal";
import { SuggestPanel } from "./SuggestPanel";
import { TaskCard } from "./TaskCard";
import { TaskDrawer } from "./TaskDrawer";

type Toast = { id: number; text: string; kind: "ok" | "err" };

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.28" } } }),
};

function tasksIn(board: BoardPayload, column: Column): DerivedTask[] {
  return board.tasks
    .filter((task) => task.column === column)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function ColumnLane({
  column,
  tasks,
  titleById,
  showCritical,
  onOpen,
}: {
  column: Column;
  tasks: DerivedTask[];
  titleById: Map<string, string>;
  showCritical: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column}` });
  const copy = COLUMN_COPY[column];
  const blocked = tasks.filter((task) => task.readiness === "BLOCKED").length;

  return (
    <section className={isOver ? "column is-over" : "column"} ref={setNodeRef}>
      <header className="column-head">
        <span className="column-index">{copy.index}</span>
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.hint}</p>
        </div>
        <div className="column-count">
          <strong>{tasks.length}</strong>
          {blocked > 0 ? <span>{blocked} blocked</span> : null}
        </div>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="column-list">
          {tasks.length === 0 ? (
            <p className="column-empty">Drop a ready task here</p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                titleById={titleById}
                showCritical={showCritical}
                onOpen={onOpen}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function BoardApp({ initialBoard }: { initialBoard: BoardPayload }) {
  const [board, setBoard] = useState(initialBoard);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showCritical, setShowCritical] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const titleById = useMemo(
    () => new Map(board.tasks.map((task) => [task.id, task.title])),
    [board.tasks],
  );
  const openTask = board.tasks.find((task) => task.id === openId) ?? null;
  const activeTask = board.tasks.find((task) => task.id === activeId) ?? null;
  const blockedCount = board.tasks.filter((task) => task.readiness === "BLOCKED").length;
  const readyCount = board.tasks.length - blockedCount;
  const criticalCount = board.tasks.filter((task) => task.onCriticalPath).length;
  const projectFinish = board.tasks.reduce(
    (latest, task) => (task.effectiveFinish > latest ? task.effectiveFinish : latest),
    "",
  );

  function toast(text: string, kind: "ok" | "err" = "ok") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5200);
  }

  function applyBoard(next: BoardPayload) {
    setBoard(next);
  }

  function destination(event: DragEndEvent): { column: Column; index: number } | null {
    const { active, over } = event;
    if (!over) return null;
    const overId = String(over.id);
    if (overId.startsWith("col:")) {
      const column = overId.slice(4) as Column;
      return { column, index: tasksIn(board, column).filter((task) => task.id !== active.id).length };
    }
    const overTask = board.tasks.find((task) => task.id === overId);
    if (!overTask) return null;
    const siblings = tasksIn(board, overTask.column).filter((task) => task.id !== active.id);
    const index = siblings.findIndex((task) => task.id === overTask.id);
    return { column: overTask.column, index: index < 0 ? siblings.length : index };
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const dest = destination(event);
    if (!dest) return;
    const id = String(event.active.id);
    const current = board.tasks.find((task) => task.id === id);
    if (!current) return;
    const blocked = moveDecision(current, dest.column, titleById);
    if (!blocked.ok) {
      toast(blocked.message, "err");
      return;
    }
    const snapshot = board;
    try {
      applyBoard(await moveTaskRequest(id, dest.column, dest.index));
    } catch (error) {
      applyBoard(snapshot);
      toast((error as ApiError).error ?? "The move was rejected.", "err");
    }
  }

  async function regressSchema() {
    const snapshot = board;
    try {
      applyBoard(await moveTaskRequest("schema", "IN_PROGRESS", 0));
      toast("Schema left Done. Downstream Done cards should stay in Done and turn Blocked.");
    } catch (error) {
      applyBoard(snapshot);
      toast((error as ApiError).error ?? "Rollback demo failed.", "err");
    }
  }

  async function resetDemo() {
    try {
      applyBoard(await resetBoardRequest());
      toast("Board restored to the 9 seeded tasks.");
    } catch (error) {
      toast((error as ApiError).error ?? "Reset failed.", "err");
    }
  }

  function exportSchedule() {
    const payload = {
      note: "plannedStart and durationDays are stored. effective dates, readiness, slack, and critical path are derived and never written back.",
      projectFinish: projectFinish || null,
      tasks: board.tasks,
      edges: board.edges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "taskflow-schedule.json";
    link.click();
    URL.revokeObjectURL(url);
    toast("Derived schedule exported. Stored dates were not rewritten.");
  }

  async function runDiamond() {
    const schema = board.tasks.find((task) => task.id === "schema");
    const integration = board.tasks.find((task) => task.id === "integration");
    if (!schema || !integration) {
      toast("Seed the board to run the diamond demo.", "err");
      return;
    }
    const before = integration.effectiveFinish;
    try {
      const seeded = SEED_TASKS.find((task) => task.id === "schema")!.durationDays;
      const next = await patchTask("schema", { durationDays: seeded + 3 });
      applyBoard(next);
      const after = next.tasks.find((task) => task.id === "integration")?.effectiveFinish;
      toast(
        `Schema +3 days. Integration tests moved from ${formatDate(before)} to ${formatDate(after ?? before)} — once, not twice.`,
      );
    } catch (error) {
      toast((error as ApiError).error ?? "Diamond demo failed.", "err");
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>TaskFlow Pro</h1>
          <span>dag board</span>
        </div>
        <dl className="vitals">
          <div>
            <dt>ready</dt>
            <dd>{readyCount}</dd>
          </div>
          <div>
            <dt>blocked</dt>
            <dd>{blockedCount}</dd>
          </div>
          <div>
            <dt>edges</dt>
            <dd>{board.edges.length}</dd>
          </div>
          <div>
            <dt>finish</dt>
            <dd>{projectFinish ? formatDate(projectFinish) : "—"}</dd>
          </div>
          <div>
            <dt>cp</dt>
            <dd>{criticalCount}</dd>
          </div>
        </dl>
        <div className="top-actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showCritical}
              onChange={(event) => setShowCritical(event.target.checked)}
            />
            CP
          </label>
          <button type="button" className="ghost" onClick={exportSchedule}>
            Export
          </button>
          <button type="button" className="ghost" onClick={resetDemo}>
            Reset
          </button>
          <button type="button" className="ghost" onClick={regressSchema}>
            Regress schema
          </button>
          <button type="button" className="ghost" onClick={() => setSuggesting(true)}>
            Suggest
          </button>
          <button type="button" className="ghost" onClick={runDiamond}>
            Schema +3d
          </button>
          <button type="button" className="primary" onClick={() => setCreating(true)}>
            New task
          </button>
        </div>
      </header>

      {board.tasks.length === 0 ? (
        <div className="empty-board">
          <h2>No work on the board yet</h2>
          <p>Create the first task, or seed the nine-task diamond from the README.</p>
          <button type="button" className="primary" onClick={() => setCreating(true)}>
            Create a task
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="board">
            {COLUMNS.map((column) => (
              <ColumnLane
                key={column}
                column={column}
                tasks={tasksIn(board, column)}
                titleById={titleById}
                showCritical={showCritical}
                onOpen={setOpenId}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeTask ? (
              <div className="card card-overlay">
                <h3>{activeTask.title}</h3>
                <p className="fine">{activeTask.readiness.toLowerCase()}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ol className="walkthrough">
        <li><b>1</b> Reset if the board looks dirty</li>
        <li><b>2</b> Schema +3d — Integration tests move once, not twice</li>
        <li><b>3</b> Drag Integration tests into In progress — refused</li>
        <li><b>4</b> Regress schema — later Done cards stay Done and turn Blocked</li>
        <li><b>5</b> Suggest — ranked by days moved; Accept still runs the cycle check</li>
      </ol>

      {openTask ? (
        <>
          <button type="button" className="scrim" aria-label="Close drawer" onClick={() => setOpenId(null)} />
          <TaskDrawer
            task={openTask}
            board={board}
            onClose={() => setOpenId(null)}
            onBoard={applyBoard}
            onToast={toast}
          />
        </>
      ) : null}

      {suggesting ? (
        <>
          <button type="button" className="scrim" aria-label="Close suggestions" onClick={() => setSuggesting(false)} />
          <SuggestPanel
            open={suggesting}
            board={board}
            onClose={() => setSuggesting(false)}
            onBoard={applyBoard}
            onToast={toast}
          />
        </>
      ) : null}

      <CreateTaskModal
        open={creating}
        onClose={() => setCreating(false)}
        onBoard={applyBoard}
        onToast={toast}
      />

      <div className="toasts" aria-live="polite">
        {toasts.map((item) => (
          <p key={item.id} className={item.kind === "err" ? "toast toast-err" : "toast"}>
            {item.text}
          </p>
        ))}
      </div>
    </div>
  );
}
