import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@todolist/db', () => ({
  getPendingNotes: vi.fn(),
  applyEnrichment: vi.fn().mockResolvedValue(undefined),
}));

import { getPendingNotes, applyEnrichment } from '@todolist/db';
import { runPendingEnrichment, newEnrichState, MAX_ENRICH_ATTEMPTS } from '@/lib/notes/enrichPending';

const db = {} as any;

describe('runPendingEnrichment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('invokes enrichment for each pending note', async () => {
    (getPendingNotes as any).mockResolvedValue([
      { id: 'n1', source_url: 'https://a.com' },
      { id: 'n2', source_url: 'https://b.com' },
    ]);
    const invoke = vi.fn().mockResolvedValue(true);
    await runPendingEnrichment(db, invoke, newEnrichState());
    expect(invoke).toHaveBeenCalledWith('n1', 'https://a.com');
    expect(invoke).toHaveBeenCalledWith('n2', 'https://b.com');
  });

  it('does not re-invoke a note whose call already succeeded this session', async () => {
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: 'https://a.com' }]);
    const invoke = vi.fn().mockResolvedValue(true);
    const state = newEnrichState();
    await runPendingEnrichment(db, invoke, state);
    await runPendingEnrichment(db, invoke, state);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed call, then gives up after the maximum attempts', async () => {
    expect(MAX_ENRICH_ATTEMPTS).toBe(3);
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: 'https://a.com' }]);
    const invoke = vi.fn().mockResolvedValue(false);
    const state = newEnrichState();

    await runPendingEnrichment(db, invoke, state);
    await runPendingEnrichment(db, invoke, state);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(applyEnrichment).not.toHaveBeenCalled();

    await runPendingEnrichment(db, invoke, state);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(applyEnrichment).toHaveBeenCalledWith(db, 'n1', null);
  });

  it('marks a pending note with no url as failed without calling the function', async () => {
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: null }]);
    const invoke = vi.fn();
    await runPendingEnrichment(db, invoke, newEnrichState());
    expect(invoke).not.toHaveBeenCalled();
    expect(applyEnrichment).toHaveBeenCalledWith(db, 'n1', null);
  });

  it('does not double-invoke when two runs overlap', async () => {
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: 'https://a.com' }]);
    let release!: (ok: boolean) => void;
    const invoke = vi.fn(() => new Promise<boolean>((r) => { release = r; }));
    const state = newEnrichState();
    const first = runPendingEnrichment(db, invoke, state);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const second = runPendingEnrichment(db, invoke, state);
    release(true);
    await Promise.all([first, second]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
