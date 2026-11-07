import { useState } from "react";
import { ArrowDownToLine, Cloud, Cpu, CornerDownLeft, Lock, Sparkles } from "lucide-react";
import { ACTIONS, type Action } from "../lib/ai";
import { POSTURES, type OnDeviceStatus, type Posture } from "../lib/firebase";
import type { MarginEntry } from "../lib/store";

type Props = {
  posture: Posture;
  setPosture: (p: Posture) => void;
  device: OnDeviceStatus;
  online: boolean;
  cloudConfigured: boolean;
  busy: Action | null;
  partial: string;
  error: string | null;
  entries: MarginEntry[];
  onRun: (a: Action, question?: string) => void;
  onApply: (text: string) => void;
  disabled: boolean;
};

const SOURCE = {
  on_device: { label: "on-device", icon: Cpu, cls: "text-mint border-mint/40 bg-mint/10" },
  in_cloud: { label: "cloud", icon: Cloud, cls: "text-violet-2 border-violet/40 bg-violet/10" },
  unknown: { label: "unknown", icon: Sparkles, cls: "text-text-3 border-line bg-panel-2" },
};

export function MarginPanel(p: Props) {
  const [question, setQuestion] = useState("");
  const ask = ACTIONS.find((a) => a.id === "ask")!;
  const deviceReady = p.device === "available";

  return (
    <aside className="border-l border-line bg-panel/60 flex flex-col min-h-0 max-lg:hidden">
      {/* Posture dial */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-line">
        <span className="label">the margin</span>
        <div className="flex rounded-md border border-line p-0.5 bg-bg/60">
          {(Object.keys(POSTURES) as Posture[]).map((k) => (
            <button
              key={k}
              onClick={() => p.setPosture(k)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono tracking-wide transition-colors ${
                p.posture === k ? "bg-panel-3 text-text" : "text-text-3 hover:text-text-2"
              }`}
              title={POSTURES[k].blurb}
            >
              {k === "private" && <Lock className="inline size-3 mr-1 -mt-0.5" />}
              {POSTURES[k].title}
            </button>
          ))}
        </div>
      </div>

      {/* Route status */}
      <div className="px-4 py-3 border-b border-line grid grid-cols-2 gap-2">
        <Status
          ok={deviceReady}
          icon={Cpu}
          title="Gemini Nano"
          sub={
            p.device === "available"
              ? "ready on this device"
              : p.device === "downloadable"
                ? "downloadable · first run will fetch it"
                : p.device === "downloading"
                  ? "downloading…"
                  : p.device === "unsupported"
                    ? "no built-in model in this browser"
                    : "unavailable here"
          }
        />
        <Status
          ok={p.cloudConfigured && p.online}
          icon={Cloud}
          title="Gemini cloud"
          sub={!p.cloudConfigured ? "add firebase config" : p.online ? "reachable" : "offline"}
        />
      </div>
      <p className="px-4 py-2.5 text-[12px] text-text-2 border-b border-line leading-relaxed">{POSTURES[p.posture].blurb}</p>

      {/* Actions */}
      <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-1.5">
        {ACTIONS.filter((a) => a.id !== "ask").map((a) => (
          <button
            key={a.id}
            disabled={p.disabled || Boolean(p.busy)}
            onClick={() => p.onRun(a)}
            className="group text-left rounded-md border border-line bg-panel px-3 py-2 hover:border-violet disabled:opacity-40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text">{a.label}</span>
              <kbd className="font-mono text-[10px] text-text-3 group-hover:text-violet-2">⌘{a.key}</kbd>
            </div>
            <p className="text-[11px] text-text-3 mt-0.5">{a.hint}</p>
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) {
            p.onRun(ask, question.trim());
            setQuestion("");
          }
        }}
        className="px-4 pb-3 relative"
      >
        <input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={p.disabled || Boolean(p.busy)}
          placeholder="Ask the margin about this note…  ⌘/"
          className="w-full rounded-md border border-line bg-bg/60 pl-3 pr-9 py-2.5 text-[13px] outline-none focus:border-violet placeholder:text-text-3 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!question.trim() || Boolean(p.busy)}
          className="absolute right-6 top-1/2 -translate-y-[calc(50%+6px)] grid place-items-center size-6 rounded bg-violet-2 text-bg disabled:opacity-30"
          aria-label="Ask"
        >
          <CornerDownLeft className="size-3.5" />
        </button>
      </form>

      {/* Stream + history */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 border-t border-line pt-3">
        {p.error && <p className="rise text-[12px] text-rose border border-rose/30 bg-rose/10 rounded-md px-3 py-2">{p.error}</p>}
        {p.busy && (
          <div className="rise rounded-md border border-line bg-panel p-3">
            <div className="flex items-center justify-between">
              <span className="label">{p.busy.label}</span>
              <span className="thinking h-1.5 w-16 rounded-full" />
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-text-2 whitespace-pre-wrap">{p.partial || "…"}</p>
          </div>
        )}
        {p.entries.length === 0 && !p.busy && (
          <p className="text-[12px] text-text-3 leading-relaxed pt-2">
            The margin is empty. Run an action and the result lands here, tagged with where it ran and how long it took.
          </p>
        )}
        {p.entries.map((e) => {
          const s = SOURCE[e.source];
          const Icon = s.icon;
          const action = ACTIONS.find((a) => a.id === e.action);
          return (
            <article key={e.id} className="rise rounded-md border border-line bg-panel p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="label">{action?.label ?? e.action}</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] ${s.cls}`}>
                  <Icon className="size-3" /> {s.label} · {e.ms} ms
                </span>
              </div>
              {e.question && <p className="mt-1.5 text-[12px] text-text-3 italic">“{e.question}”</p>}
              <p className="mt-2 text-[13px] leading-relaxed text-text whitespace-pre-wrap">{e.text}</p>
              {["tighten", "warmer", "translate"].includes(e.action) && (
                <button
                  onClick={() => p.onApply(e.text)}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono text-violet-2 hover:text-white"
                >
                  <ArrowDownToLine className="size-3" /> replace note with this
                </button>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function Status({ ok, icon: Icon, title, sub }: { ok: boolean; icon: typeof Cpu; title: string; sub: string }) {
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`relative size-1.5 rounded-full ${ok ? "bg-mint pulse-ring" : "bg-text-3"}`} />
        <Icon className="size-3.5 text-text-2" />
        <span className="text-[12px] text-text">{title}</span>
      </div>
      <p className="text-[11px] text-text-3 mt-1 leading-snug">{sub}</p>
    </div>
  );
}
