import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  }),
}));
vi.mock('@todolist/db', () => ({ createNote: vi.fn().mockResolvedValue('note-1') }));

import { createNote } from '@todolist/db';
import { useNewNote } from '@/hooks/useNewNote';

describe('useNewNote', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a blank note for the signed-in user and opens it', async () => {
    const { result } = renderHook(() => useNewNote());
    // userId loads asynchronously; the callback returns null until it has.
    await waitFor(async () => {
      expect(await result.current()).toBe('note-1');
    });
    expect(createNote).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: null });
    expect(push).toHaveBeenCalledWith('/notes/note-1');
  });

  it('creates the note inside a project when given one', async () => {
    const { result } = renderHook(() => useNewNote());
    await waitFor(async () => {
      expect(await result.current({ projectId: 'p1' })).toBe('note-1');
    });
    expect(createNote).toHaveBeenLastCalledWith(expect.anything(), { userId: 'user-1', projectId: 'p1' });
  });
});
