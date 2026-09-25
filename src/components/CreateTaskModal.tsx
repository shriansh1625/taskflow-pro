"use client";

import { useState, type FormEvent } from "react";
import type { BoardPayload, Column } from "@/engine";
import { COLUMNS } from "@/engine";
import { createTask, type ApiError } from "@/lib/api";
import { COLUMN_COPY } from "@/lib/copy";

type Props = {
  open: boolean;
  onClose: () => void;
  onBoard: (board: BoardPayload) => void;
  onToast: (message: string, kind?: "ok" | "err") => void;
};

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function CreateTaskModal({ open, onClose, onBoard, onToast }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plannedStart, setPlannedStart] = useState(todayIso);
  const [durationDays, setDurationDays] = useState("3");
  const [column, setColumn] = useState<Column>("BACKLOG");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const days = Number(durationDays);
    if (!title.trim() || !Number.isInteger(days) || days < 1) {
      onToast("Give the task a title and a duration of at least one day.", "err");
      return;
    }
    setBusy(true);
    try {
      onBoard(
        await createTask({
          title: title.trim(),
          description,
          plannedStart,
          durationDays: days,
          column,
        }),
      );
      onToast("Task added to the board.");
      setTitle("");
      setDescription("");
      onClose();
    } catch (error) {
      onToast((error as ApiError).error ?? "Could not create the task.", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Create a task</h2>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What has to happen?"
            required
            autoFocus
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Enough for a reviewer to see the dependency."
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
        <label>
          Column
          <select value={column} onChange={(event) => setColumn(event.target.value as Column)}>
            {COLUMNS.map((item) => (
              <option key={item} value={item}>
                {COLUMN_COPY[item].title}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy}>
            Add to board
          </button>
        </div>
      </form>
    </div>
  );
}
