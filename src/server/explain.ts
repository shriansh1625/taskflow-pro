import { explainCriticalPath, explainTask } from "@/engine/explain";
import type { DerivedTask } from "@/engine";
import { publicModelError } from "./suggest";

export type Explanation = {
  source: "model" | "engine";
  text: string;
  note: string | null;
};

function factSheet(tasks: DerivedTask[], taskId?: string): string {
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const path = explainCriticalPath(tasks);
  if (!taskId) return path;
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return path;
  return `${explainTask(task, titles)} ${path}`;
}

async function rewriteFacts(facts: string): Promise<string> {
  const key = process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set.");
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const endpoint = process.env.GROQ_API_URL ?? "https://api.groq.com/openai/v1/chat/completions";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the fact sheet as one short paragraph for a delivery lead. Use only facts in the sheet. Do not invent tasks, dates, or delays. No markdown.",
          },
          { role: "user", content: facts },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}.`);
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null; reasoning?: string | null } }[];
    };
    const message = payload.choices?.[0]?.message;
    const text = (message?.content || message?.reasoning || "").trim();
    if (text.length < 40) throw new Error("Model did not return JSON.");
    return text.slice(0, 700);
  } finally {
    clearTimeout(timer);
  }
}

export async function explainBoard(tasks: DerivedTask[], taskId?: string): Promise<Explanation> {
  const facts = factSheet(tasks, taskId);
  try {
    const text = await rewriteFacts(facts);
    return { source: "model", text, note: null };
  } catch (error) {
    return { source: "engine", text: facts, note: publicModelError(error) };
  }
}
