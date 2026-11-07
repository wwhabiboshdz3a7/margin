# Margin — notes with an AI in the margin

> #BuildHybridAI 2026 entry by [wwhabiboshdz3a7](https://github.com/wwhabiboshdz3a7). A notebook where the AI runs on your device first, and only reaches for the cloud when it has to. Built on **Firebase AI Logic hybrid inference**.

Most "AI notes" apps ship every keystroke to a server. Margin doesn't. The AI sits in the margin of the page, reads the note you're looking at, and answers on the laptop with Gemini Nano. When the device can't (no built-in model, a note too long, a weak machine), Firebase AI Logic routes the same request to Gemini in the cloud. Every answer is stamped with **where it ran** and **how long it took**, so the hybrid story isn't a claim, it's visible on every result.

## What you can do in the margin

| Action | ⌘ | What it does |
|---|---|---|
| Summarize | 1 | three lines, in the note's own words |
| Pull out to-dos | 2 | every action item as a checklist |
| Tighten | 3 | same meaning, ~30% fewer words (one click to replace the note) |
| Make it warmer | 4 | for a message you're about to send |
| Translate → FR | 5 | keeps lists and line breaks |
| Name this note | 6 | a five-word title, auto-applied to untitled notes |
| Ask the margin | / | a question answered only from this note |

Notes and margin results persist in IndexedDB. Nothing syncs.

## The hybrid part

`src/lib/firebase.ts` builds one `GenerativeModel` per privacy posture, straight from the SDK's `HybridParams`:

| Posture | `InferenceMode` | Behaviour |
|---|---|---|
| **Private** | `ONLY_ON_DEVICE` | Nothing leaves the machine. Works fully offline. Errors clearly if Gemini Nano isn't available. |
| **Auto** (default) | `PREFER_ON_DEVICE` | On-device first; the SDK falls back to the cloud model when the device can't serve the request. |
| **Cloud** | `ONLY_IN_CLOUD` | Always `gemini-2.5-flash` (configurable), for long notes or machines without a built-in model. |

Every request streams (`generateContentStream`) so the margin fills in as the model writes, and the final `response.inferenceSource` is what drives the **on-device / cloud** badge and the latency readout. The panel header also probes `LanguageModel.availability()` so you can see *before* asking whether Gemini Nano is ready, downloadable, or absent, and whether the cloud path is configured and reachable.

## Run it

```bash
npm install
cp .env.example .env.local   # add your Firebase web config (optional for Private mode)
npm run dev                  # http://localhost:5191
```

- **On-device:** Chrome 138+ with the built-in model (chrome://flags → *Prompt API for Gemini Nano* → enabled, then *Optimization Guide On Device Model* → enabled bypass). Margin reports the model's state in the panel.
- **Cloud:** a Firebase project with **AI Logic** enabled on the Gemini Developer API; paste the web app config into `.env.local`.

Try it offline: turn off Wi-Fi, switch to Private, and keep working.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · `firebase/ai` 13 (hybrid inference) · `idb`.

## Author

[wwhabiboshdz3a7](https://github.com/wwhabiboshdz3a7) — solo entry.

## License

MIT. See [LICENSE](LICENSE).
