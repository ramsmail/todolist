import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return { ...actual, useLogbook: vi.fn(), useLabels: vi.fn() };
});

import { useLogbook, useLabels } from '@todolist/db';
import LogbookPage from '@/app/logbook/page';

const TASKS = [
  { id: '1', title: 'Task A', priority: 3, due_date: null, status: 'completed',
    updated_at: new Date().toISOString(), project_id: null, labels: '[]' },
  { id: '2', title: 'Task B', priority: 2, due_date: '2026-06-10', status: 'completed',
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    project_id: null, labels: '[]' },
  { id: '3', title: 'Task C', priority: 1, due_date: null, status: 'completed',
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    project_id: null, labels: '[]' },
];

describe('LogbookPage', () => {
  beforeEach(() => {
    (useLabels as any).mockReturnValue({ data: [] });
  });

  it('shows empty state when no tasks completed', () => {
    (useLogbook as any).mockReturnValue({ data: [] });
    render(<LogbookPage />);
    expect(screen.getByText('Nothing completed yet')).toBeInTheDocument();
  });

  it('groups tasks into Today, This week, Earlier buckets', () => {
    (useLogbook as any).mockReturnValue({ data: TASKS });
    render(<LogbookPage />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
  });

  it('renders task titles in the correct buckets', () => {
    (useLogbook as any).mockReturnValue({ data: TASKS });
    render(<LogbookPage />);
    expect(screen.getByText('Task A')).toBeInTheDocument(); // today
    expect(screen.getByText('Task B')).toBeInTheDocument(); // this week
    expect(screen.getByText('Task C')).toBeInTheDocument(); // earlier
  });

  it('does not render empty buckets', () => {
    const todayOnly = [TASKS[0]];
    (useLogbook as any).mockReturnValue({ data: todayOnly });
    render(<LogbookPage />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.queryByText('This week')).not.toBeInTheDocument();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
  });
});
