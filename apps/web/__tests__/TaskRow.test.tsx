import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from '@/components/tasks/TaskRow';
import { describe, it, expect, vi } from 'vitest';

const TASK = { id: '1', title: 'Buy milk', priority: 2, due_date: null, status: 'inbox' };

describe('TaskRow', () => {
  it('renders task title', () => {
    render(<TaskRow task={TASK} onPress={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('calls onPress when content area clicked', () => {
    const onPress = vi.fn();
    render(<TaskRow task={TASK} onPress={onPress} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Open task: Buy milk'));
    expect(onPress).toHaveBeenCalledWith('1');
  });

  it('calls onComplete when checkbox clicked', () => {
    const onComplete = vi.fn();
    render(<TaskRow task={TASK} onPress={vi.fn()} onComplete={onComplete} />);
    fireEvent.click(screen.getByLabelText('Complete Buy milk'));
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('shows overdue date in red', () => {
    const overdue = { ...TASK, due_date: '2020-01-01' };
    render(<TaskRow task={overdue} onPress={vi.fn()} onComplete={vi.fn()} />);
    const dateEl = screen.getByText('2020-01-01');
    expect(dateEl).toHaveClass('text-p1');
  });
});
