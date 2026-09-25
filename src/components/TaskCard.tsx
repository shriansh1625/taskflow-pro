"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DerivedTask } from "@/engine";
import { formatDate } from "@/lib/copy";

type Props = {
  task: DerivedTask;
  titleById: Map<string, string>;
  showCritical: boolean;
  onOpen: (id: string) => void;
};

export function TaskCard({ task, titleById, showCritical, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const [flash, setFlash] = useState(false);
  const previousFinish = useRef(task.effectiveFinish);

  useEffect(() => {
    if (previousFinish.current === task.effectiveFinish) return;
    previousFinish.current = task.effectiveFinish;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(timer);
  }, [task.effectiveFinish]);

  const blockers = task.unmetPredecessorIds.map((id) => titleById.get(id) ?? id).slice(0, 2);
  const heldBy = task.bindingPredecessorId ? titleById.get(task.bindingPredecessorId) : null;

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "card",
        task.readiness === "BLOCKED" ? "card-blocked" : "card-ready",
        showCritical && task.onCriticalPath ? "card-critical" : "",
        isDragging ? "card-dragging" : "",
        flash ? "card-flash" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button type="button" className="card-grip" aria-label={`Drag ${task.title}`} {...attributes} {...listeners} />
      <button type="button" className="card-body" onClick={() => onOpen(task.id)}>
        <span className={task.readiness === "BLOCKED" ? "stamp stamp-block" : "stamp stamp-ready"}>
          {task.readiness === "BLOCKED" ? "blocked" : "ready"}
        </span>
        <h3>{task.title}</h3>
        <dl className="card-meta">
          <div>
            <dt>due</dt>
            <dd>{formatDate(task.effectiveFinish)}</dd>
          </div>
          <div>
            <dt>len</dt>
            <dd>{task.durationDays}d</dd>
          </div>
        </dl>
        {task.readiness === "BLOCKED" && blockers.length > 0 ? (
          <p className="card-blockers">needs {blockers.join(", ")}</p>
        ) : (
          <p className="card-held">{heldBy ? `held by ${heldBy}` : "own start"}</p>
        )}
      </button>
    </article>
  );
}
