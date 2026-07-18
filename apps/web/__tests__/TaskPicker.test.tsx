import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskPicker } from '@/components/focus/TaskPicker';

const tasks = [
  { id: '1', title: 'Review Q4 strategy document' },
  { id: '2', title: 'Write release notes' },
];

describe('TaskPicker', () => {
  it('lists every in-focus task as an option', () => {
    render(<TaskPicker tasks={tasks} activeTask={null} onSelect={vi.fn()} />);
    expect(screen.getByText('Review Q4 strategy document')).toBeInTheDocument();
    expect(screen.getByText('Write release notes')).toBeInTheDocument();
  });

  it('calls onSelect with the chosen task', () => {
    const onSelect = vi.fn();
    render(<TaskPicker tasks={tasks} activeTask={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    expect(onSelect).toHaveBeenCalledWith(tasks[1]);
  });

  it('shows an empty state when there are no in-focus tasks', () => {
    render(<TaskPicker tasks={[]} activeTask={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/No tasks in focus/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
