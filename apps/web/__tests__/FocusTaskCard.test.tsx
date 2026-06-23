import { render, screen, fireEvent } from '@testing-library/react';
import { FocusTaskCard } from '@/components/today/FocusTaskCard';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@todolist/db', () => ({
  useLabels: () => ({
    data: [
      { name: 'work', color: '#3B82F6' },
      { name: 'urgent', color: '#EF4444' },
    ],
  }),
}));

const TASK = {
  id: 'task-1',
  title: 'Complete project proposal',
  priority: 1,
  due_date: '2026-06-25',
  due_time: '14:30',
  labels: '["work", "urgent"]',
  project_name: 'My Project',
  project_color: '#6366F1',
};

describe('FocusTaskCard', () => {
  let onPress: ReturnType<typeof vi.fn>;
  let onComplete: ReturnType<typeof vi.fn>;
  let onToggleFocus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPress = vi.fn();
    onComplete = vi.fn();
    onToggleFocus = vi.fn();
  });

  it('renders task title', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByText('Complete project proposal')).toBeInTheDocument();
  });

  it('renders project name with colored indicator', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByLabelText('Priority 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority 1')).toHaveTextContent('P1');
  });

  it('calls onPress when task content is clicked', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    fireEvent.click(screen.getByLabelText('Open task: Complete project proposal'));
    expect(onPress).toHaveBeenCalledWith('task-1');
  });

  it('calls onComplete when complete button is clicked', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    fireEvent.click(screen.getByLabelText('Complete Complete project proposal'));
    expect(onComplete).toHaveBeenCalledWith('task-1');
  });

  it('calls onToggleFocus when focus button is clicked', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove Complete project proposal from focus'));
    expect(onToggleFocus).toHaveBeenCalledWith('task-1');
  });

  it('renders labels from task', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('renders due time in HH:MM format', () => {
    const { container } = render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    const timeText = container.textContent;
    expect(timeText).toContain('14:30');
  });

  it('does not render project name if not provided', () => {
    const taskWithoutProject = { ...TASK, project_name: undefined };
    render(
      <FocusTaskCard
        task={taskWithoutProject}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.queryByText('My Project')).not.toBeInTheDocument();
  });

  it('does not render due time if not provided', () => {
    const taskWithoutTime = { ...TASK, due_time: undefined };
    render(
      <FocusTaskCard
        task={taskWithoutTime}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.queryByText('14:30')).not.toBeInTheDocument();
  });

  it('handles task without labels', () => {
    const taskWithoutLabels = { ...TASK, labels: undefined };
    render(
      <FocusTaskCard
        task={taskWithoutLabels}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByText('Complete project proposal')).toBeInTheDocument();
    expect(screen.queryByText('work')).not.toBeInTheDocument();
  });

  it('stops event propagation on complete button click', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    const completeButton = screen.getByLabelText('Complete Complete project proposal');
    const event = new MouseEvent('click', { bubbles: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    fireEvent(completeButton, event);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('stops event propagation on toggle focus button click', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    const focusButton = screen.getByLabelText('Remove Complete project proposal from focus');
    const event = new MouseEvent('click', { bubbles: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    fireEvent(focusButton, event);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('renders with correct priority color for P1', () => {
    const { container } = render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    const priorityBadge = screen.getByLabelText('Priority 1');
    expect(priorityBadge).toHaveStyle({ color: '#EF4444' });
  });
});
