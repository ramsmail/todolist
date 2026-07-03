import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
  useQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useTodayTasks: vi.fn(),
    useTodayStats: vi.fn(),
    useProjects:   vi.fn(),
  };
});

vi.mock('@/components/today/IvyLeeList', () => ({
  IvyLeeList: ({ tasks }: any) => (
    <div data-testid="ivy-lee-list">
      {tasks.map((t: any) => <span key={t.id}>{t.title}</span>)}
    </div>
  ),
}));
vi.mock('@/components/today/LaterTodaySection', () => ({
  LaterTodaySection: ({ tasks }: any) => (
    <div data-testid="later-section">{tasks.length} later</div>
  ),
}));
vi.mock('@/components/today/TodayStatsRow', () => ({
  TodayStatsRow: () => <div data-testid="stats-row">Stats</div>,
}));
vi.mock('@/components/tasks/TaskDetailPanel', () => ({
  TaskDetailPanel: () => null,
}));
vi.mock('@/components/tasks/QuickCaptureModal', () => ({
  QuickCaptureModal: () => null,
}));

import { useTodayTasks, useTodayStats, useProjects } from '@todolist/db';
import TodayPage from '@/app/today/page';

const FOCUS_TASK = {
  id: 'f1', title: 'Ship MVP', priority: 1,
  due_date: '2026-07-03', project_id: null, status: 'active',
  labels: '[]', recurrence_rule: null, in_focus: 1, sort_order: 'a1',
};
const LATER_TASK = {
  id: 'l1', title: 'Reply emails', priority: 3,
  due_date: '2026-07-03', project_id: null, status: 'active',
  labels: '[]', recurrence_rule: null, in_focus: 0, sort_order: 'b1',
};

beforeEach(() => {
  (useProjects as any).mockReturnValue({ data: [] });
  (useTodayStats as any).mockReturnValue({ data: [{ total: 2, completed: 0 }] });
  (useTodayTasks as any).mockReturnValue({ data: [] });
});

describe('TodayPage', () => {
  it('renders a greeting', () => {
    render(<TodayPage />);
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
  });

  it('renders IvyLeeList', () => {
    render(<TodayPage />);
    expect(screen.getByTestId('ivy-lee-list')).toBeInTheDocument();
  });

  it('passes focus tasks to IvyLeeList', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByTestId('ivy-lee-list')).toHaveTextContent('Ship MVP');
  });

  it('passes later tasks to LaterTodaySection', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByTestId('later-section')).toHaveTextContent('1 later');
  });

  it('renders stats row', () => {
    render(<TodayPage />);
    expect(screen.getByTestId('stats-row')).toBeInTheDocument();
  });

  it('renders Start Focus Session button', () => {
    render(<TodayPage />);
    expect(screen.getByText(/Start Focus Session/)).toBeInTheDocument();
  });
});
