import { applyEnrichment, getPendingNotes } from '@todolist/db';

type Db = Parameters<typeof getPendingNotes>[0];

export const MAX_ENRICH_ATTEMPTS = 3;

export interface EnrichState {
  attempts: Map<string, number>;
  invoked: Set<string>;
}

export function newEnrichState(): EnrichState {
  return { attempts: new Map(), invoked: new Set() };
}

// Shared by the create/paste paths and the reconnect runner.
export const enrichState = newEnrichState();

export async function runPendingEnrichment(
  db: Db,
  invoke: (noteId: string, url: string) => Promise<boolean>,
  state: EnrichState
): Promise<void> {
  const pending = await getPendingNotes(db);
  for (const note of pending) {
    if (!note.source_url) {
      await applyEnrichment(db, note.id, null);
      continue;
    }
    if (state.invoked.has(note.id)) continue;

    const used = state.attempts.get(note.id) ?? 0;
    if (used >= MAX_ENRICH_ATTEMPTS) {
      await applyEnrichment(db, note.id, null);
      continue;
    }

    state.attempts.set(note.id, used + 1);
    state.invoked.add(note.id);
    const ok = await invoke(note.id, note.source_url);
    if (!ok) {
      state.invoked.delete(note.id);
      if (used + 1 >= MAX_ENRICH_ATTEMPTS) await applyEnrichment(db, note.id, null);
    }
  }
}
