"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { BoardPayload, DerivedTask, PreviewResult } from "@/engine";
import {
  addDependencyRequest,
  deleteTaskRequest,
  patchTask,
  previewDependencyRequest,
  removeDependencyRequest,
  type ApiError,
} from "@/lib/api";
import { COLUMN_COPY, formatDate } from "@/lib/copy";

type Props = {
  task: DerivedTask;
  board: BoardPayload;
  onClose: () => void;
  onBoard: (board: BoardPayload) => void;
  onToast: (message: string, kind?: "ok" | "err") => void;
};

export function TaskDrawer({ task, board, onClose, onBoard, onToast }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [plannedStart, setPlannedStart] = useState(task.plannedStart);
  const [durationDays, setDurationDays] = useState(String(task.durationDays));
  const [predecessorId, setPredecessorId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setPlannedStart(task.plannedStart);
    setDurationDays(String(task.durationDays));
    setPredecessorId("");
    setPreview(null);
  }, [task]);

  const titleById = useMemo(
    () => new Map(board.tasks.map((item) => [item.id, item.title])),
    [board.tasks],
  );

  const incoming = board.edges.filter((edge) => edge.successorId === task.id);
  const outgoing = board.edges.filter((edge) => edge.predecessorId === task.id);
  const candidates = board.tasks.filter(
    (item) =>
      item.id !== task.id &&
      !incoming.some((edge) => edge.predecessorId === item.id),
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    const days = Number(durationDays);
    if (!title.trim() || !plannedStart || !Number.isInteger(days) || days < 1) {
      onToast("Title, a start date, and a duration of at least 1 day are required.", "err");
      return;
    }
    setBusy(true);
    try {
      onBoard(
        await patchTask(task.id, {
          title: title.trim(),
          description,
          plannedStart,
          durationDays: days,
        }),
      );
      onToast("Schedule recomputed from planned dates.");
    } catch (error) {
      onToast((error as ApiError).error ?? "Could not save the task.", "err");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview(id: string) {
    setPredecessorId(id);
    setPreview(null);
    if (!id) return;
    try {
      setPreview(await previewDependencyRequest(id, task.id));
    } catch (error) {
      onToast((error as ApiError).error ?? "Preview failed.", "err");
    }
  }

  async function acceptDependency() {
    if (!predecessorId) return;
    setBusy(true);
    try {
      onBoard(await addDependencyRequest(predecessorId, task.id));
      onToast("Dependency saved. Dates moved only where the edge binds.");
      setPredecessorId("");
      setPreview(null);
    } catch (error) {
      const api = error as ApiError;
      onToast(api.error ?? "Dependency was rejected.", "err");
    } finally {
      setBusy(false);
    }
  }

  async function dropEdge(predecessor: string) {
    setBusy(true);
    try {
      onBoard(await removeDependencyRequest(predecessor, task.id));
      onToast("Edge removed. Downstream dates recomputed.");
    } catch (error) {
      onToast((error as ApiError).error ?? "Could not remove the edge.", "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${task.title}”? Downstream tasks will recompute.`)) return;
    setBusy(true);
    try {
      onBoard(await deleteTaskRequest(task.id));
      onToast("Task deleted.");
      onClose();
    } catch (error) {
      onToast((error as ApiError).error ?? "Could not delete the task.", "err");
    } finally {
      setBusy(false);
    }
  }

  const heldBy = task.bindingPredecessorId
    ? titleById.get(task.bindingPredecessorId)
    : null;

  return (
    <aside className="drawer" role="dialog" aria-labelledby="drawer-title">
      <header className="drawer-head">
        <div>
          <p className="eyebrow">Task detail</p>
          <h2 id="drawer-title">{task.title}</h2>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="drawer-flags">
        <span className={task.readiness === "BLOCKED" ? "stamp stamp-block" : "stamp stamp-ready"}>
          {task.readiness}
        </span>
        <span className="stamp">{COLUMN_COPY[task.column].title}</span>
        {task.onCriticalPath ? <span className="stamp">critical path</span> : null}
      </div>

      <dl className="stat-grid">
        <div>
          <dt>Effective start</dt>
          <dd>{formatDate(task.effectiveStart)}</dd>
        </div>
        <div>
          <dt>Effective finish</dt>
          <dd>{formatDate(task.effectiveFinish)}</dd>
        </div>
        <div>
          <dt>Held by</dt>
          <dd>{heldBy ?? "Own planned start"}</dd>
        </div>
        <div>
          <dt>Slack</dt>
          <dd>{task.slackDays} day{task.slackDays === 1 ? "" : "s"}</dd>
        </div>
      </dl>

      {task.unmetPredecessorIds.length > 0 ? (
        <section className="callout">
          <h3>Blocked by</h3>
          <ul>
            {task.unmetPredecessorIds.map((id) => (
              <li key={id}>{titleById.get(id) ?? id}</li>
            ))}
          </ul>
          <p>This card can move backward, but not into a later column.</p>
        </section>
      ) : null}

      <form className="stack" onSubmit={save}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="split">
          <label>
            Planned start
            <input
              type="date"
              value={plannedStart}
              onChange={(event) => setPlannedStart(event.target.value)}
              required
            />
          </label>
          <label>
            Duration (days)
            <input
              type="number"
              min={1}
              step={1}
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
              required
            />
          </label>
        </div>
        <p className="fine">
          Only planned start and duration are stored. Downstream finishes are derived, so a later
          slip cannot stack on a previous one.
        </p>
        <button type="submit" className="primary" disabled={busy}>
          Save and recompute
        </button>
      </form>

      <section className="stack">
        <h3>Prerequisites</h3>
        {incoming.length === 0 ? <p className="fine">No prerequisites. This task is Ready.</p> : null}
        <ul className="edge-list">
          {incoming.map((edge) => (
            <li key={edge.predecessorId}>
              <span>{titleById.get(edge.predecessorId) ?? edge.predecessorId}</span>
              <button
                type="button"
                className="text-btn"
                onClick={() => dropEdge(edge.predecessorId)}
                disabled={busy}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label>
          Add a prerequisite
          <select value={predecessorId} onChange={(event) => loadPreview(event.target.value)}>
            <option value="">Choose a task that must finish first</option>
            {candidates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {preview && !preview.ok ? (
          <div className="callout danger">
            <p>{preview.message}</p>
            {preview.path.length > 0 ? (
              <p className="fine">{preview.path.map((id) => titleById.get(id) ?? id).join(" → ")}</p>
            ) : null}
          </div>
        ) : null}
        {preview && preview.ok ? (
          <div className="callout">
            <p>
              {preview.bindsSuccessor
                ? "This edge would bind the successor."
                : "This edge would not bind. Dates stay where a later predecessor already holds them."}
            </p>
            {preview.shifts.length === 0 ? (
              <p className="fine">No effective finishes would move.</p>
            ) : (
              <ul>
                {preview.shifts.slice(0, 6).map((shift) => (
                  <li key={shift.taskId}>
                    {titleById.get(shift.taskId) ?? shift.taskId}: {shift.deltaDays > 0 ? "+" : ""}
                    {shift.deltaDays} day{Math.abs(shift.deltaDays) === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="primary" onClick={acceptDependency} disabled={busy}>
              Accept dependency
            </button>
          </div>
        ) : null}
      </section>

      <section className="stack">
        <h3>Downstream</h3>
        {outgoing.length === 0 ? (
          <p className="fine">Nothing waits on this task.</p>
        ) : (
          <ul className="edge-list">
            {outgoing.map((edge) => (
              <li key={edge.successorId}>{titleById.get(edge.successorId) ?? edge.successorId}</li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="danger-btn" onClick={remove} disabled={busy}>
        Delete task
      </button>
    </aside>
  );
}
