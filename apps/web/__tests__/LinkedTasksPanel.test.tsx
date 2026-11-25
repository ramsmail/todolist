import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@todolist/db', () => ({
  useLinkedTasks: vi.fn(),
  useTaskSearch: vi.fn(),
  completeTask: vi.fn().mockResolvedValue(undefined),
  unlinkNoteFromTask: vi.fn().mockResolvedValue(undefined),
  linkNoteToTask: vi.fn().mockResolvedValue(undefined),
  createLinkedTask: vi.fn().mockResolvedValue({ taskId: 't9' }),
}));

import {
  useLinkedTasks, useTaskSearch, completeTask, unlinkNoteFromTask, linkNoteToTask, createLinkedTask,
} from '@todolist/db';
import { LinkedTasksPanel } from '@/components/notes/LinkedTasksPanel';

const linked = [
  { id: 't1', title: 'Call the bank', status: 'inbox', priority: 4, due_date: null, project_id: null },
  { id: 't2', title: 'Pay rent', status: 'completed', priority: 4, due_date: null, project_id: null },
];

describe('LinkedTasksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLinkedTasks as any).mockReturnValue({ data: linked });
    (useTaskSearch as any).mockReturnValue({ data: [] });
  });

  it('lists linked tasks and shows completed ones as checked', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    expect(screen.getByText('Call the bank')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Complete Call the bank' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Complete Pay rent' })).toBeChecked();
  });

  it('shows an empty state', () => {
    (useLinkedTasks as any).mockReturnValue({ data: [] });
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    expect(screen.getByText('No linked tasks')).toBeInTheDocument();
  });

  it('completes a task in place', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Call the bank' }));
    expect(completeTask).toHaveBeenCalledWith(expect.anything(), 't1');
  });

  it('unlinks without deleting the task', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Call the bank' }));
    expect(unlinkNoteFromTask).toHaveBeenCalledWith(expect.anything(), 'n1', 't1');
  });

  it('links an existing task, hiding tasks that are already linked', async () => {
    (useTaskSearch as any).mockReturnValue({
      data: [{ id: 't1', title: 'Call the bank' }, { id: 't9', title: 'Pay the electricity bill' }],
    });
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ Link existing' }));
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'bill' } });

    expect(screen.queryByRole('button', { name: 'Call the bank' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay the electricity bill' }));
    await waitFor(() => expect(linkNoteToTask).toHaveBeenCalledWith(expect.anything(), 'u1', 'n1', 't9'));
  });

  it('creates and links a new task', async () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    const input = screen.getByLabelText('New task title');
    fireEvent.change(input, { target: { value: '  Book flights ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(createLinkedTask).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', noteId: 'n1', title: 'Book flights' })
    );
  });

  it('does not create a task with a blank title', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    fireEvent.keyDown(screen.getByLabelText('New task title'), { key: 'Enter' });
    expect(createLinkedTask).not.toHaveBeenCalled();
  });
});
