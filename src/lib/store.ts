import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type MarginEntry = {
  id: string;
  noteId: string;
  action: string;
  question?: string;
  text: string;
  source: "on_device" | "in_cloud" | "unknown";
  ms: number;
  at: number;
};

interface MarginDB extends DBSchema {
  notes: { key: string; value: Note; indexes: { byUpdated: number } };
  margins: { key: string; value: MarginEntry; indexes: { byNote: string } };
}

let dbp: Promise<IDBPDatabase<MarginDB>> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB<MarginDB>("margin", 1, {
      upgrade(d) {
        const n = d.createObjectStore("notes", { keyPath: "id" });
        n.createIndex("byUpdated", "updatedAt");
        const m = d.createObjectStore("margins", { keyPath: "id" });
        m.createIndex("byNote", "noteId");
      },
    });
  }
  return dbp;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function listNotes(): Promise<Note[]> {
  const all = await (await db()).getAllFromIndex("notes", "byUpdated");
  return all.reverse();
}
export async function putNote(note: Note) {
  await (await db()).put("notes", note);
}
export async function deleteNote(id: string) {
  const d = await db();
  await d.delete("notes", id);
  const entries = await d.getAllFromIndex("margins", "byNote", id);
  await Promise.all(entries.map((e) => d.delete("margins", e.id)));
}
export async function listMargins(noteId: string): Promise<MarginEntry[]> {
  const all = await (await db()).getAllFromIndex("margins", "byNote", noteId);
  return all.sort((a, b) => b.at - a.at);
}
export async function putMargin(entry: MarginEntry) {
  await (await db()).put("margins", entry);
}

export const SEED_NOTES: Omit<Note, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "Monday, with the landlord",
    body: `Met Mrs. Okafor about the lease. She's fine with the two-year renewal but wants the rent review moved to March instead of September. I said I'd check with Sam before agreeing.

Things she flagged:
- the boiler service is overdue (she'll send the engineer's number)
- the back gate latch is broken again, she'll replace it if we paint the fence
- she'd like a copy of our contents insurance by the end of the month

I need to email Sam tonight, call the insurer tomorrow, and put the painting on a weekend before it gets cold. She mentioned her son is starting at the same school as Lila, which explains the sudden friendliness.`,
  },
  {
    title: "Draft: reply to Theo",
    body: `Theo, got your message. I don't think I can take on the extra shift this week — Lila has her recital Thursday and I've already promised. I can do next Tuesday and Wednesday if that helps, and I'm happy to swap a Saturday later in the month. Let me know what works. Sorry to let you down on this one.`,
  },
  {
    title: "Ideas for the garden",
    body: `Raised beds along the south wall, two of them, cedar if we can afford it. Tomatoes, basil, the chilli plants from Dad. A water butt off the shed gutter. Ask the neighbour whether the fig tree casts shade in the afternoon before committing to the second bed. Someone on the allotment forum said rhubarb thrives on neglect, which is my kind of plant.`,
  },
];
