import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchPage from '@/app/search/page';

vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/components/tasks/TaskDetailPanel', () => ({ TaskDetailPanel: () => null }));
vi.mock('@/components/tasks/TaskList', () => ({
  TaskList: ({ tasks }: { tasks: { id: string; title: string }[] }) => (
    <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
  ),
}));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useTaskSearch: vi.fn(),
  useNoteSearch: vi.fn(),
  completeTask: vi.fn(),
}));

import { useTaskSearch, useNoteSearch } from '@todolist/db';

const noteRow = {
  id: 'n1', title: 'Budget ideas', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: null, labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z',
};

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTaskSearch as any).mockReturnValue({ data: [{ id: 't1', title: 'Pay the bill' }] });
    (useNoteSearch as any).mockReturnValue({ data: [noteRow] });
  });

  it('asks for a query before showing anything', () => {
    render(<SearchPage />);
    expect(screen.getByText('Type to search')).toBeInTheDocument();
    expect(screen.queryByText('Pay the bill')).toBeNull();
  });

  it('searches tasks by default', () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'bill' } });
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill');
    expect(screen.getByText('Pay the bill')).toBeInTheDocument();
    expect(screen.queryByText('Budget ideas')).toBeNull();
  });

  it('switches to notes', () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'budget' } });
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByText('Budget ideas')).toBeInTheDocument();
    expect(screen.queryByText('Pay the bill')).toBeNull();
  });

  it('includes archived notes only when asked', () => {
    render(<SearchPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(useNoteSearch).toHaveBeenLastCalledWith('', false);
    fireEvent.click(screen.getByLabelText('Include archived'));
    expect(useNoteSearch).toHaveBeenLastCalledWith('', true);
  });

  it('says when nothing matches', () => {
    (useTaskSearch as any).mockReturnValue({ data: [] });
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
