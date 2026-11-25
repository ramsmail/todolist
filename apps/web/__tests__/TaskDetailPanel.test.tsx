import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

let mockTask: any;

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useTask: vi.fn(() => ({ data: [mockTask] })),
    useSubtasks: vi.fn(() => ({ data: [] })),
    useAttachmentsForTask: vi.fn(() => ({ data: [] })),
    useProjects: vi.fn(() => ({ data: [] })),
    useLabels: vi.fn(() => ({ data: [{ id: '1', name: 'work', color: '#6366F1' }, { id: '2', name: 'home', color: '#10B981' }] })),
    updateTaskTitle: vi.fn(),
    updateTaskDescription: vi.fn(),
    updateTaskPriority: vi.fn(),
    updateTaskProject: vi.fn(),
    updateTaskDue: vi.fn(),
    updateTaskRecurrence: vi.fn(),
    setTaskLabels: vi.fn(),
    deleteTask: vi.fn(),
    createTask: vi.fn(),
    completeTask: vi.fn(),
  };
});

import { updateTaskDescription, setTaskLabels } from '@todolist/db';

describe('TaskDetailPanel description field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTask = {
      id: 'task-1',
      title: 'Buy milk',
      description: null,
      priority: 3,
      due_date: null,
      recurrence_rule: null,
      project_id: null,
      labels: '[]',
    };
  });

  it('shows an "Add description" prompt when the task has no description', () => {
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    expect(screen.getByLabelText('Edit task description')).toHaveTextContent('Add description');
  });

  it('renders the existing description as read-only text', () => {
    mockTask.description = 'Pick up 2% milk on the way home';
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    expect(screen.getByText('Pick up 2% milk on the way home')).toBeInTheDocument();
  });

  it('clicking the description shows an editable textarea seeded with the current value', () => {
    mockTask.description = 'Existing notes';
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Edit task description'));
    expect(screen.getByDisplayValue('Existing notes')).toBeInTheDocument();
  });

  it('saves the description on blur when the value changed', async () => {
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Edit task description'));
    const textarea = screen.getByDisplayValue('');
    fireEvent.change(textarea, { target: { value: 'New notes' } });
    fireEvent.blur(textarea);
    await waitFor(() =>
      expect(updateTaskDescription).toHaveBeenCalledWith(expect.anything(), 'task-1', 'New notes')
    );
  });

  it('does not call updateTaskDescription on blur when the value is unchanged', async () => {
    mockTask.description = 'Unchanged';
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Edit task description'));
    fireEvent.blur(screen.getByDisplayValue('Unchanged'));
    await new Promise((r) => setTimeout(r, 0));
    expect(updateTaskDescription).not.toHaveBeenCalled();
  });

  it('renders a URL in the description as a clickable link', () => {
    mockTask.description = 'See https://example.com/doc for details';
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'https://example.com/doc' });
    expect(link).toHaveAttribute('href', 'https://example.com/doc');
  });

  it('renders a URL in the title as a clickable link', () => {
    mockTask.title = 'Read https://example.com/article';
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'https://example.com/article' });
    expect(link).toHaveAttribute('href', 'https://example.com/article');
  });

  it('shows the task\'s current labels', () => {
    mockTask.labels = '["work"]';
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('calls setTaskLabels when a label is added via the picker', () => {
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Add labels'));
    fireEvent.click(screen.getByRole('option', { name: 'work' }));
    expect(setTaskLabels).toHaveBeenCalledWith(expect.anything(), 'task-1', ['work']);
  });
});
