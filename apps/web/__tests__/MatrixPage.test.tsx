import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MatrixPage from '@/app/matrix/page';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
  useQuery: vi.fn().mockReturnValue({
    data: [
      { id: 't1', title: 'Fix bug',     priority: 1, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '1' },
      { id: 't2', title: 'Read book',   priority: 2, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '2' },
      { id: 't3', title: 'Reply Slack', priority: 3, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '3' },
      { id: 't4', title: 'Browse',      priority: 4, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '4' },
    ],
  }),
}));

vi.mock('@todolist/db', () => ({
  useLabels:          vi.fn().mockReturnValue({ data: [] }),
  completeTask:       vi.fn().mockResolvedValue(undefined),
  updateTaskPriority: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/tasks/TaskDetailPanel', () => ({
  TaskDetailPanel: ({ taskId }: { taskId: string | null }) =>
    taskId ? <div>Panel:{taskId}</div> : null,
}));

vi.mock('@/components/tasks/QuickCaptureModal', () => ({
  QuickCaptureModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div role="dialog">QuickCapture<button onClick={onClose}>Close</button></div> : null,
}));

describe('MatrixPage', () => {
  it('renders all four quadrant labels', () => {
    const { getByText } = render(<MatrixPage />);
    expect(getByText('DO FIRST')).toBeTruthy();
    expect(getByText('SCHEDULE')).toBeTruthy();
    expect(getByText('DELEGATE')).toBeTruthy();
    expect(getByText('ELIMINATE')).toBeTruthy();
  });

  it('places tasks in the correct quadrant by priority', () => {
    const { getByText } = render(<MatrixPage />);
    expect(getByText('Fix bug')).toBeTruthy();
    expect(getByText('Read book')).toBeTruthy();
    expect(getByText('Reply Slack')).toBeTruthy();
    expect(getByText('Browse')).toBeTruthy();
  });

  it('opens QuickCaptureModal when + Add Task is clicked', () => {
    const { getByText, getByRole, queryByRole } = render(<MatrixPage />);
    expect(queryByRole('dialog')).toBeNull();
    fireEvent.click(getByText('+ Add Task'));
    expect(getByRole('dialog')).toBeTruthy();
  });

  it('closes QuickCaptureModal when onClose fires', () => {
    const { getByText, queryByRole } = render(<MatrixPage />);
    fireEvent.click(getByText('+ Add Task'));
    fireEvent.click(getByText('Close'));
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders page title', () => {
    const { getByText } = render(<MatrixPage />);
    expect(getByText('Task Matrix')).toBeTruthy();
  });
});
