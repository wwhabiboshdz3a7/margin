import { InferenceSource } from "firebase/ai";
import { modelFor, type Posture } from "./firebase";

export type ActionId = "summarize" | "todos" | "tighten" | "warmer" | "translate" | "title" | "ask";

export type Action = {
  id: ActionId;
  label: string;
  key: string; // keyboard shortcut (with ⌘/Ctrl)
  hint: string;
  prompt: (note: string, extra?: string) => string;
};

export const ACTIONS: Action[] = [
  {
    id: "summarize",
    label: "Summarize",
    key: "1",
    hint: "three lines, in the note's own words",
    prompt: (n) => `Summarize the note below in at most three short sentences. Keep the writer's voice. No preamble.\n\nNOTE:\n${n}`,
  },
  {
    id: "todos",
    label: "Pull out to-dos",
    key: "2",
    hint: "every action item, one per line",
    prompt: (n) =>
      `List every action item, task or follow-up in the note below as a checklist, one per line, starting each line with "- [ ] ". If there are none, reply exactly: No to-dos in this note.\n\nNOTE:\n${n}`,
  },
  {
    id: "tighten",
    label: "Tighten",
    key: "3",
    hint: "same meaning, fewer words",
    prompt: (n) => `Rewrite the note below to be clearer and about 30% shorter. Keep every fact, the structure and the tone. Output only the rewritten note.\n\nNOTE:\n${n}`,
  },
  {
    id: "warmer",
    label: "Make it warmer",
    key: "4",
    hint: "for a message you're about to send",
    prompt: (n) => `Rewrite the text below so it reads warm and human without becoming longer or less direct. Output only the rewritten text.\n\nTEXT:\n${n}`,
  },
  {
    id: "translate",
    label: "Translate → FR",
    key: "5",
    hint: "to French, keeping formatting",
    prompt: (n) => `Translate the note below into natural French. Keep line breaks and lists. Output only the translation.\n\nNOTE:\n${n}`,
  },
  {
    id: "title",
    label: "Name this note",
    key: "6",
    hint: "a title of five words or fewer",
    prompt: (n) => `Give the note below a title of at most five words. Output only the title, no quotes, no period.\n\nNOTE:\n${n}`,
  },
  {
    id: "ask",
    label: "Ask the margin",
    key: "/",
    hint: "a question about this note",
    prompt: (n, q) => `Answer the question using only the note below. If the note doesn't say, say so in one sentence.\n\nNOTE:\n${n}\n\nQUESTION: ${q}`,
  },
];

export type RunResult = {
  text: string;
  source: "on_device" | "in_cloud" | "unknown";
  ms: number;
  chars: number;
};

/** Runs one margin action through the hybrid model and reports where it ran and how long it took. */
export async function run(action: Action, posture: Posture, note: string, extra?: string, onChunk?: (partial: string) => void): Promise<RunResult> {
  const model = modelFor(posture);
  const prompt = action.prompt(note.trim(), extra?.trim());
  const t0 = performance.now();

  const result = await model.generateContentStream(prompt);
  let text = "";
  for await (const chunk of result.stream) {
    text += chunk.text();
    onChunk?.(text);
  }
  const response = await result.response;
  const src = response.inferenceSource;
  const source: RunResult["source"] =
    src === InferenceSource.ON_DEVICE ? "on_device" : src === InferenceSource.IN_CLOUD ? "in_cloud" : "unknown";
  return { text: text.trim(), source, ms: Math.round(performance.now() - t0), chars: prompt.length };
}
