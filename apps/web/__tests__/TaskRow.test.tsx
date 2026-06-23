import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from '@/components/tasks/TaskRow';
import { LabelChip } from '@/components/tasks/LabelChip';
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

  it('renders label chips and a recurring badge', () => {
    const task = {
      id: 't1', title: 'Water plants', priority: 4, due_date: null, status: 'active',
      labels: '["home"]', recurrence_rule: 'FREQ=DAILY',
    };
    render(<TaskRow task={task as any} onPress={() => {}} onComplete={() => {}} />);
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.getByLabelText('Recurring')).toBeInTheDocument();
  });
});
