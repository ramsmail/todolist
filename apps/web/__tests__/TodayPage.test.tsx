import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
  useQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useTodayTasks:  vi.fn(),
    useTodayStats:  vi.fn(),
    useProjects:    vi.fn(),
    useLabels:      vi.fn(),
    useWeeklyActivity: vi.fn(),
    useStreak:      vi.fn(),
    completeTask:   vi.fn(),
    toggleFocus:    vi.fn(),
  };
});

import {
  useTodayTasks, useTodayStats, useProjects, useLabels,
  useWeeklyActivity, useStreak,
} from '@todolist/db';
import TodayPage from '@/app/today/page';

const FOCUS_TASK = {
  id: 'f1', title: 'Ship MVP', priority: 1,
  due_date: '2026-06-23', due_time: '14:00:00',
  project_id: 'p1', status: 'active', labels: '[]',
  recurrence_rule: null, in_focus: 1,
};

const LATER_TASK = {
  id: 'l1', title: 'Reply emails', priority: 3,
  due_date: '2026-06-23', due_time: null,
  project_id: null, status: 'active', labels: '[]',
  recurrence_rule: null, in_focus: 0,
};

beforeEach(() => {
  (useProjects as any).mockReturnValue({ data: [
    { id: 'p1', name: 'App Studio', color: '#6366F1' },
  ]});
  (useLabels as any).mockReturnValue({ data: [] });
  (useTodayStats as any).mockReturnValue({ data: [{ total: 2, completed: 0 }] });
  (useWeeklyActivity as any).mockReturnValue([
    { day: '2026-06-23', count: 0 },
    { day: '2026-06-24', count: 0 },
    { day: '2026-06-25', count: 0 },
    { day: '2026-06-26', count: 0 },
    { day: '2026-06-27', count: 0 },
  ]);
  (useStreak as any).mockReturnValue({ count: 0, days: Array(7).fill(false) });
});

describe('TodayPage', () => {
  it('shows empty state when no tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [] });
    render(<TodayPage />);
    expect(screen.getByText(/All done for today/)).toBeInTheDocument();
  });

  it('renders IN FOCUS section for tasks with in_focus=1', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByText('In Focus')).toBeInTheDocument();
    expect(screen.getByText('Ship MVP')).toBeInTheDocument();
  });

  it('renders LATER TODAY section for non-focus tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByText('Later Today')).toBeInTheDocument();
    expect(screen.getByText('Reply emails')).toBeInTheDocument();
  });

  it('hides IN FOCUS section when no focus tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [LATER_TASK] });
    render(<TodayPage />);
    expect(screen.queryByText('In Focus')).not.toBeInTheDocument();
  });

  it('renders Focus Session widget', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK] });
    render(<TodayPage />);
    expect(screen.getByText('Focus Session')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('shows task + in focus count in subtitle', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByText(/2 tasks · 1 in focus/)).toBeInTheDocument();
  });
});
