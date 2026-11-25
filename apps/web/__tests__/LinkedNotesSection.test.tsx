import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
}));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useLinkedNotes: vi.fn(),
  useNoteSearch: vi.fn(),
  linkNoteToTask: vi.fn().mockResolvedValue(undefined),
  unlinkNoteFromTask: vi.fn().mockResolvedValue(undefined),
  createLinkedNote: vi.fn().mockResolvedValue({ noteId: 'n9' }),
}));

import { useLinkedNotes, useNoteSearch, linkNoteToTask, unlinkNoteFromTask, createLinkedNote } from '@todolist/db';
import { LinkedNotesSection } from '@/components/notes/LinkedNotesSection';

const linked = [{ id: 'n1', title: 'Meeting notes', body: '', link_title: null, source_url: null, updated_at: '2026-11-25T10:00:00.000Z' }];

describe('LinkedNotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLinkedNotes as any).mockReturnValue({ data: linked });
    (useNoteSearch as any).mockReturnValue({ data: [] });
  });

  it('lists linked notes as links to the editor', () => {
    render(<LinkedNotesSection taskId="t1" />);
    expect(screen.getByRole('link', { name: 'Meeting notes' })).toHaveAttribute('href', '/notes/n1');
  });

  it('shows an empty state', () => {
    (useLinkedNotes as any).mockReturnValue({ data: [] });
    render(<LinkedNotesSection taskId="t1" />);
    expect(screen.getByText('No linked notes')).toBeInTheDocument();
  });

  it('unlinks without deleting the note', () => {
    render(<LinkedNotesSection taskId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Meeting notes' }));
    expect(unlinkNoteFromTask).toHaveBeenCalledWith(expect.anything(), 'n1', 't1');
  });

  it('links an existing note, hiding notes already linked', async () => {
    (useNoteSearch as any).mockReturnValue({
      data: [
        { id: 'n1', title: 'Meeting notes', body: '', link_title: null },
        { id: 'n2', title: 'Budget ideas', body: '', link_title: null },
      ],
    });
    render(<LinkedNotesSection taskId="t1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Link existing' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '+ Link existing' }));
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'budget' } });

    expect(screen.queryByRole('button', { name: 'Meeting notes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Budget ideas' }));
    await waitFor(() => expect(linkNoteToTask).toHaveBeenCalledWith(expect.anything(), 'u1', 'n2', 't1'));
  });

  it('creates a linked note and opens it', async () => {
    render(<LinkedNotesSection taskId="t1" />);
    // The button is a no-op until the current user id has loaded; flush that effect first.
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: '+ New note' }));
    await waitFor(() => expect(createLinkedNote).toHaveBeenCalledTimes(1));
    expect(createLinkedNote).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', taskId: 't1', title: '' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/notes/n9'));
  });
});
