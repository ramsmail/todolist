import { render, screen, fireEvent } from '@testing-library/react';
import { FocusTaskCard } from '@/components/today/FocusTaskCard';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@todolist/db', () => ({
  useLabels: vi.fn(() => ({ data: [
    { name: 'home', color: '#10B981' },
    { name: 'work', color: '#3B82F6' },
  ] })),
}));

const TASK = {
  id: '1',
  title: 'Complete project report',
  priority: 1,
  due_date: '2024-01-15',
  due_time: '14:30',
  labels: '["work"]',
  project_name: 'Q1 Planning',
  project_color: '#8B5CF6',
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

  it('renders title and project name', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByText('Complete project report')).toBeInTheDocument();
    expect(screen.getByText('Q1 Planning')).toBeInTheDocument();
  });

  it('calls onComplete when checkbox clicked', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    fireEvent.click(screen.getByLabelText('Complete Complete project report'));
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('calls onPress when content area clicked', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    fireEvent.click(screen.getByLabelText('Open task: Complete project report'));
    expect(onPress).toHaveBeenCalledWith('1');
  });

  it('calls onToggleFocus when unpin button clicked', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove Complete project report from focus'));
    expect(onToggleFocus).toHaveBeenCalledWith('1');
  });

  it('shows priority badge', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByLabelText('Priority 1')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  it('renders due time and label chips', () => {
    render(
      <FocusTaskCard
        task={TASK}
        onPress={onPress}
        onComplete={onComplete}
        onToggleFocus={onToggleFocus}
      />
    );
    expect(screen.getByText((content, element) => content.includes('14:30'))).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
  });
});
