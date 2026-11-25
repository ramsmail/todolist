import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotePage from '@/app/notes/[id]/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'n1' }), useRouter: () => ({ push }) }));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
}));
vi.mock('@/components/notes/NoteEditor', () => ({
  NoteEditor: ({ note }: { note: { id: string } }) => <div data-testid="editor">{note.id}</div>,
}));
vi.mock('@/components/notes/LinkedTasksPanel', () => ({
  LinkedTasksPanel: () => <div data-testid="linked-tasks" />,
}));
vi.mock('@/components/projects/ProjectPicker', () => ({ ProjectPicker: () => <div data-testid="project-picker" /> }));
vi.mock('@/components/tasks/LabelPicker', () => ({ LabelPicker: () => <div data-testid="label-picker" /> }));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useNote: vi.fn(),
  archiveNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  setNoteProject: vi.fn(),
  setNoteLabels: vi.fn(),
}));

import { useNote, archiveNote, deleteNote } from '@todolist/db';

let notes: Record<string, any>;
const note = (over: Record<string, unknown> = {}) => ({
  id: 'n1', title: 'Plan', body: 'text', source_url: null, link_title: null, link_excerpt: null,
  link_image_url: null, link_site_name: null, link_status: null, project_id: null, labels: '[]',
  is_archived: 0, conflict_of: null, ...over,
});

describe('NotePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notes = { n1: note() };
    (useNote as any).mockImplementation((id: string) => ({ data: notes[id] ? [notes[id]] : [], isLoading: false }));
  });

  it('renders the editor and the linked tasks panel', () => {
    render(<NotePage />);
    expect(screen.getByTestId('editor')).toHaveTextContent('n1');
    expect(screen.getByTestId('linked-tasks')).toBeInTheDocument();
  });

  it('shows not found for a missing note', () => {
    notes = {};
    render(<NotePage />);
    expect(screen.getByText('Note not found')).toBeInTheDocument();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('shows a loading state while the note loads', () => {
    (useNote as any).mockReturnValue({ data: [], isLoading: true });
    render(<NotePage />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the link preview card for a link note', () => {
    notes.n1 = note({ source_url: 'https://example.com/a', link_title: 'An article', link_status: 'ok' });
    render(<NotePage />);
    expect(screen.getByText('An article')).toBeInTheDocument();
  });

  it('archives and unarchives', () => {
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archiveNote).toHaveBeenCalledWith(expect.anything(), 'n1', true);
  });

  it('offers Unarchive for an archived note', () => {
    notes.n1 = note({ is_archived: 1 });
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }));
    expect(archiveNote).toHaveBeenCalledWith(expect.anything(), 'n1', false);
  });

  it('deletes after confirmation and returns to the list', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    await waitFor(() => expect(deleteNote).toHaveBeenCalledWith(expect.anything(), 'n1'));
    expect(push).toHaveBeenCalledWith('/notes');
    vi.unstubAllGlobals();
  });

  it('does not delete when the confirmation is declined', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(deleteNote).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  describe('conflict copy', () => {
    beforeEach(() => {
      notes.n1 = note({ conflict_of: 'orig' });
      notes.orig = note({ id: 'orig', title: 'Original plan' });
    });

    it('shows the banner naming the original and opens it', () => {
      render(<NotePage />);
      expect(screen.getByText(/Conflict copy of/)).toHaveTextContent('Original plan');
      fireEvent.click(screen.getByRole('button', { name: 'Open original' }));
      expect(push).toHaveBeenCalledWith('/notes/orig');
    });

    it('deletes the copy after confirmation and goes to the original', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      render(<NotePage />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete copy' }));
      await waitFor(() => expect(deleteNote).toHaveBeenCalledWith(expect.anything(), 'n1'));
      expect(push).toHaveBeenCalledWith('/notes/orig');
      vi.unstubAllGlobals();
    });

    it('copes with an original that no longer exists', () => {
      delete notes.orig;
      render(<NotePage />);
      expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open original' })).toBeNull();
    });
  });
});
