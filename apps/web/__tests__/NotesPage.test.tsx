import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotesPage from '@/app/notes/page';

const newNote = vi.fn();
vi.mock('@/hooks/useNewNote', () => ({ useNewNote: () => newNote }));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useNotesList: vi.fn(),
  useProjects: vi.fn(),
  useLabels: vi.fn(),
}));

import { useNotesList, useProjects, useLabels } from '@todolist/db';

const row = (over: Record<string, unknown>) => ({
  id: 'x', title: '', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: null, labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z', ...over,
});

const thought = row({ id: 'a', title: 'A thought', project_id: 'p1', labels: '["work"]' });
const link = row({ id: 'b', title: 'A saved link', source_url: 'https://x.com' });

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNotesList as any).mockReturnValue({ data: [thought, link] });
    (useProjects as any).mockReturnValue({ data: [{ id: 'p1', name: 'Work', color: '#111111' }] });
    (useLabels as any).mockReturnValue({ data: [{ id: 'l1', name: 'work', color: '#6366F1' }] });
  });

  it('renders the heading and a row per note', () => {
    render(<NotesPage />);
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.getByText('A saved link')).toBeInTheDocument();
  });

  it('shows an empty state when there are no notes', () => {
    (useNotesList as any).mockReturnValue({ data: [] });
    render(<NotesPage />);
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('filters to links and to thoughts', () => {
    render(<NotesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    expect(screen.queryByText('A thought')).toBeNull();
    expect(screen.getByText('A saved link')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thoughts' }));
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.queryByText('A saved link')).toBeNull();
  });

  it('filters by project and by label', () => {
    render(<NotesPage />);
    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: 'p1' } });
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.queryByText('A saved link')).toBeNull();

    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by label'), { target: { value: 'work' } });
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.queryByText('A saved link')).toBeNull();
  });

  it('says so when filters hide every note', () => {
    render(<NotesPage />);
    fireEvent.change(screen.getByLabelText('Filter by label'), { target: { value: 'work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    expect(screen.getByText('No notes match these filters')).toBeInTheDocument();
  });

  it('asks for archived notes when "Show archived" is ticked', () => {
    render(<NotesPage />);
    expect(useNotesList).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(useNotesList).toHaveBeenLastCalledWith(true);
  });

  it('creates a new note', () => {
    render(<NotesPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ New note' }));
    expect(newNote).toHaveBeenCalledTimes(1);
  });
});
