import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MatrixQuadrant } from '@/app/matrix/MatrixQuadrant';

vi.mock('@todolist/db', () => ({
  useLabels: vi.fn().mockReturnValue({ data: [] }),
}));

const TASK = {
  id: 't1', title: 'Fix bug', priority: 1,
  due_date: null, status: 'inbox', labels: null, recurrence_rule: null,
};

describe('MatrixQuadrant', () => {
  it('renders the quadrant label', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={1} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('Do First')).toBeTruthy();
  });

  it('shows empty state when no tasks', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={2} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('No tasks here')).toBeTruthy();
  });

  it('renders task titles', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={1} tasks={[TASK]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('Fix bug')).toBeTruthy();
  });

  it('calls onDropTask with quadrant number when a task is dropped', () => {
    const onDropTask = vi.fn();
    const { container } = render(
      <MatrixQuadrant quadrant={3} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={onDropTask} />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.drop(card, { dataTransfer: { getData: () => 't1' } });
    expect(onDropTask).toHaveBeenCalledWith('t1', 3);
  });

  it('shows task count in header', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={4} tasks={[TASK]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('1')).toBeTruthy();
  });
});
