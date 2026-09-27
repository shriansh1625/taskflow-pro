import { acceptRewrite, explainCriticalPath, explainTask, normalizeForCheck } from "@/engine/explain";
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
              "Rewrite the fact sheet as exactly three sentences. Sentence 1 states the finish as YYYY-MM-DD and that the date was derived. Sentence 2 states only who it is held by, copied from the sheet, and does not use the word Blocked. Sentence 3 states Ready, or Blocked by the same names as the sheet, and does not use the word held. Do not write \"held and blocked\". Do not join tasks with arrows. Do not add a date. No markdown.",
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
    const text = normalizeForCheck(await rewriteFacts(facts));
    if (!acceptRewrite(facts, text)) {
      return {
        source: "engine",
        text: facts,
        note: "Model rewrite discarded. A date, the held-by task, or the blocked-by list did not match the engine.",
      };
    }
    return {
      source: "model",
      text,
      note: "Checked. Every date is in the engine facts. Held-by and blocked-by were not merged.",
    };
  } catch (error) {
    return { source: "engine", text: facts, note: publicModelError(error) };
  }
}
