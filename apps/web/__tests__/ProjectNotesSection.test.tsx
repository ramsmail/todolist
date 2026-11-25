import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectNotesSection } from '@/components/notes/ProjectNotesSection';

const newNote = vi.fn();
vi.mock('@/hooks/useNewNote', () => ({ useNewNote: () => newNote }));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useNotesByProject: vi.fn(),
}));

import { useNotesByProject } from '@todolist/db';

const row = (over: Record<string, unknown>) => ({
  id: 'n1', title: 'Kickoff notes', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: 'p1', labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z', ...over,
});

describe('ProjectNotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNotesByProject as any).mockReturnValue({ data: [row({})] });
  });

  it('lists the project notes', () => {
    render(<ProjectNotesSection projectId="p1" />);
    expect(useNotesByProject).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Kickoff notes')).toBeInTheDocument();
  });

  it('shows an empty message', () => {
    (useNotesByProject as any).mockReturnValue({ data: [] });
    render(<ProjectNotesSection projectId="p1" />);
    expect(screen.getByText('No notes in this project yet')).toBeInTheDocument();
  });

  it('adds a note inside the project', () => {
    render(<ProjectNotesSection projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add note' }));
    expect(newNote).toHaveBeenCalledWith({ projectId: 'p1' });
  });
});
