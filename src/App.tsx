import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ACTIONS, run, type Action } from "./lib/ai";
import { cloudConfigured, onDeviceStatus, type OnDeviceStatus, type Posture } from "./lib/firebase";
import { deleteNote, listMargins, listNotes, putMargin, putNote, SEED_NOTES, uid, type MarginEntry, type Note } from "./lib/store";
import { MarginPanel } from "./components/MarginPanel";
import { Logo } from "./components/Logo";

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [posture, setPosture] = useState<Posture>(() => (localStorage.getItem("margin.posture") as Posture) || "auto");
  const [device, setDevice] = useState<OnDeviceStatus>("unsupported");
  const [online, setOnline] = useState(navigator.onLine);
  const [margins, setMargins] = useState<MarginEntry[]>([]);
  const [busy, setBusy] = useState<Action | null>(null);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  /* ------------------------------------------------------------ boot */
  useEffect(() => {
    (async () => {
      let all = await listNotes();
      if (all.length === 0) {
        const now = Date.now();
        // fixed ids keep this idempotent (React StrictMode runs effects twice in dev)
        for (const [i, s] of SEED_NOTES.entries()) await putNote({ ...s, id: `seed-${i}`, createdAt: now - i * 60000, updatedAt: now - i * 60000 });
        all = await listNotes();
      }
      setNotes(all);
      setActiveId(all[0]?.id ?? null);
    })();
    void onDeviceStatus().then(setDevice);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("margin.posture", posture);
  }, [posture]);

  useEffect(() => {
    if (!activeId) return setMargins([]);
    void listMargins(activeId).then(setMargins);
    setPartial("");
    setError(null);
  }, [activeId]);

  /* ----------------------------------------------------------- notes */
  const update = useCallback((patch: Partial<Note>) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === activeId ? { ...n, ...patch, updatedAt: Date.now() } : n));
      const changed = next.find((n) => n.id === activeId);
      if (changed) {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void putNote(changed), 300);
      }
      return next;
    });
  }, [activeId]);

  async function createNote() {
    const now = Date.now();
    const n: Note = { id: uid(), title: "", body: "", createdAt: now, updatedAt: now };
    await putNote(n);
    setNotes((p) => [n, ...p]);
    setActiveId(n.id);
  }

  async function removeNote(id: string) {
    await deleteNote(id);
    setNotes((p) => {
      const next = p.filter((n) => n.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  /* ---------------------------------------------------------- margin */
  async function runAction(action: Action, question?: string) {
    if (!active || busy) return;
    if (!active.body.trim()) return setError("Write something first; the margin reads the note.");
    setError(null);
    setBusy(action);
    setPartial("");
    try {
      const res = await run(action, posture, active.body, question, setPartial);
      const entry: MarginEntry = {
        id: uid(),
        noteId: active.id,
        action: action.id,
        question,
        text: res.text,
        source: res.source,
        ms: res.ms,
        at: Date.now(),
      };
      await putMargin(entry);
      setMargins((m) => [entry, ...m]);
      if (action.id === "title" && !active.title.trim()) update({ title: res.text.replace(/^["']|["']$/g, "") });
    } catch (e) {
      console.error("[margin] inference failed", e);
      setError(friendlyError(e, posture));
    } finally {
      setBusy(null);
      setPartial("");
    }
  }

  function applyToNote(text: string) {
    update({ body: text });
  }

  // ⌘/Ctrl + 1..6 runs an action, ⌘/Ctrl + / focuses the question box, ⌘/Ctrl + N new note
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        void createNote();
        return;
      }
      const a = ACTIONS.find((x) => x.key === e.key && x.id !== "ask");
      if (a) {
        e.preventDefault();
        void runAction(a);
      }
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("ask-input")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, busy, posture]);

  /* -------------------------------------------------------------- ui */
  return (
    <div className="h-screen grid grid-cols-[260px_1fr_380px] max-lg:grid-cols-[220px_1fr] max-md:grid-cols-1">
      {/* Notes rail */}
      <aside className="border-r border-line bg-panel/60 flex flex-col min-h-0 max-md:hidden">
        <div className="h-14 px-4 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-[22px] leading-none">Margin</span>
          </div>
          <button
            onClick={() => void createNote()}
            className="grid place-items-center size-7 rounded-md border border-line text-text-2 hover:border-violet hover:text-text transition-colors"
            title="New note (⌘N)"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="px-4 py-3 label flex items-center justify-between">
          <span>{notes.length} notes · on this device</span>
          <span className={online ? "text-mint" : "text-amber"}>{online ? "online" : "offline"}</span>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setActiveId(n.id)}
                className={`group w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                  n.id === activeId ? "bg-panel-3 text-text" : "text-text-2 hover:bg-panel-2"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-[17px] leading-tight line-clamp-1">{n.title || "Untitled"}</span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeNote(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rose transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </span>
                </div>
                <p className="text-xs text-text-3 line-clamp-1 mt-0.5">{n.body.trim().split("\n")[0] || "Empty note"}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 border-t border-line label normal-case tracking-normal text-[11px] leading-relaxed">
          Notes live in IndexedDB. Nothing syncs anywhere.
        </div>
      </aside>

      {/* Editor */}
      <main className="min-h-0 flex flex-col">
        {active ? (
          <>
            <div className="h-14 px-8 flex items-center justify-between border-b border-line">
              <input
                value={active.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Untitled"
                className="font-display text-[26px] bg-transparent outline-none placeholder:text-text-3 w-full"
              />
              <span className="label whitespace-nowrap">
                {active.body.trim().split(/\s+/).filter(Boolean).length} words · {formatWhen(active.updatedAt)}
              </span>
            </div>
            <textarea
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder="Start writing. The margin will read along."
              spellCheck={false}
              className="ruled flex-1 w-full resize-none bg-transparent outline-none px-8 py-6 text-[17px] leading-8 text-text font-sans"
            />
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-center px-8">
            <div>
              <h2 className="font-display text-4xl">Nothing here yet.</h2>
              <p className="text-text-2 mt-2">Make a note and the margin will read along.</p>
              <button onClick={() => void createNote()} className="mt-6 rounded-full bg-violet-2 text-bg px-5 py-2.5 text-sm font-medium hover:bg-white transition-colors">
                New note
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Margin */}
      <MarginPanel
        posture={posture}
        setPosture={setPosture}
        device={device}
        online={online}
        cloudConfigured={cloudConfigured}
        busy={busy}
        partial={partial}
        error={error}
        entries={margins}
        onRun={runAction}
        onApply={applyToNote}
        disabled={!active}
      />
    </div>
  );
}

function formatWhen(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function friendlyError(e: unknown, posture: Posture) {
  const msg = e instanceof Error ? e.message : String(e);
  if (posture === "private" && /on-device|on device|not available|unavailable|LanguageModel/i.test(msg))
    return "Private mode needs Gemini Nano on this device. Switch to Auto, or enable Chrome's built-in model.";
  if (/api key|API_KEY|403|400|not-configured|projectId|INVALID_ARGUMENT/i.test(msg))
    return "The cloud path isn't configured. Add your Firebase web config to .env.local (see .env.example), or stay in Private mode.";
  if (/network|fetch|Failed to fetch/i.test(msg)) return "No network for the cloud model. Private mode still works offline.";
  return msg;
}
