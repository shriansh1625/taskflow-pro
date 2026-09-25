"use client";

import { useState } from "react";
import type { BoardPayload } from "@/engine";
import type { RankedSuggestion, SuggestionReport } from "@/lib/api";
import { addDependencyRequest, requestSuggestions, type ApiError } from "@/lib/api";

type Props = {
  open: boolean;
  board: BoardPayload;
  onClose: () => void;
  onBoard: (board: BoardPayload) => void;
  onToast: (message: string, kind?: "ok" | "err") => void;
};

export function SuggestPanel({ open, board, onClose, onBoard, onToast }: Props) {
  const [report, setReport] = useState<SuggestionReport | null>(null);
  const [busy, setBusy] = useState(false);
  const titles = new Map(board.tasks.map((task) => [task.id, task.title]));

  if (!open) return null;

  async function load() {
    setBusy(true);
    try {
      setReport(await requestSuggestions());
    } catch (error) {
      onToast((error as ApiError).error ?? "Suggestions failed.", "err");
    } finally {
      setBusy(false);
    }
  }

  async function accept(item: RankedSuggestion) {
    setBusy(true);
    try {
      onBoard(await addDependencyRequest(item.predecessorId, item.successorId));
      setReport((current) =>
        current
          ? {
              ...current,
              suggestions: current.suggestions.filter(
                (row) =>
                  !(row.predecessorId === item.predecessorId && row.successorId === item.successorId),
              ),
            }
          : current,
      );
      onToast("Edge accepted through the same cycle check as a manual add.");
    } catch (error) {
      onToast((error as ApiError).error ?? "Accept was rejected.", "err");
    } finally {
      setBusy(false);
    }
  }

  function dismiss(item: RankedSuggestion) {
    setReport((current) =>
      current
        ? {
            ...current,
            suggestions: current.suggestions.filter(
              (row) =>
                !(row.predecessorId === item.predecessorId && row.successorId === item.successorId),
            ),
          }
        : current,
    );
  }

  return (
    <aside className="suggest" role="dialog" aria-labelledby="suggest-title">
      <header className="drawer-head">
        <div>
          <h2 id="suggest-title">Dependency suggestions</h2>
          <p className="fine">Not saved until you accept. Ranked by days the engine would move.</p>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </header>

      <button type="button" className="primary" onClick={load} disabled={busy}>
        {busy ? "Running…" : "Run suggestions"}
      </button>

      {report ? (
        <>
          <p className="fine">
            Source: {report.source}
            {report.modelError ? ` · model skipped (${report.modelError})` : ""}
            {report.dropped.length ? ` · ${report.dropped.length} dropped by the engine` : ""}
          </p>
          {report.dropped.length > 0 ? (
            <section className="callout">
              <h3>Dropped by the engine</h3>
              <ul>
                {report.dropped.slice(0, 8).map((item) => (
                  <li key={`${item.predecessorId}-${item.successorId}-${item.dropReason}`}>
                    {titles.get(item.predecessorId) ?? item.predecessorId}
                    {" → "}
                    {titles.get(item.successorId) ?? item.successorId}
                    {": "}
                    {item.dropReason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {report.suggestions.length === 0 ? (
            <p>Nothing survived the cycle check and catalog filter.</p>
          ) : (
            <ul className="suggest-list">
              {report.suggestions.map((item) => (
                <li
                  key={`${item.predecessorId}-${item.successorId}`}
                  className="suggest-item"
                >
                  <h3>
                    {titles.get(item.predecessorId) ?? item.predecessorId}
                    {" → "}
                    {titles.get(item.successorId) ?? item.successorId}
                  </h3>
                  <p className="fine">{item.reason}</p>
                  <p className="fine">
                    {item.totalDaysMoved} day{item.totalDaysMoved === 1 ? "" : "s"} moved
                    {item.bindsSuccessor ? " · would bind" : " · would not bind"}
                    {" · "}
                    {item.source}
                    {" · conf "}
                    {item.confidence.toFixed(2)}
                  </p>
                  <div className="modal-actions">
                    <button type="button" className="ghost" onClick={() => dismiss(item)} disabled={busy}>
                      Dismiss
                    </button>
                    <button type="button" className="primary" onClick={() => accept(item)} disabled={busy}>
                      Accept
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="fine">
          The Groq model sees stored ids, titles, planned starts, durations, and edges. Effective
          dates are not sent. Unknown ids, loops, and existing edges are stripped here. If Groq is
          down, a labeled heuristic is used instead.
        </p>
      )}
    </aside>
  );
}
