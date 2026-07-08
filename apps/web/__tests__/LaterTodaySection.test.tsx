import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));
vi.mock('@todolist/db', () => ({
  toggleFocus: vi.fn(),
  moveTask: vi.fn(),
}));
vi.mock('fractional-indexing', () => ({
  generateKeyBetween: vi.fn(() => 'new-key'),
}));

import { LaterTodaySection } from '@/components/today/LaterTodaySection';

const makeTask = (n: number) => ({
  id: `l${n}`, title: `Later Task ${n}`, priority: 3,
  sort_order: `b${n}`, project_id: null, status: 'active', in_focus: 0,
});

const makeFocusTask = (n: number) => ({
  id: `f${n}`, title: `Focus Task ${n}`, priority: 1,
  sort_order: `a${n}`, project_id: null, status: 'active', in_focus: 1,
});

describe('LaterTodaySection', () => {
  it('renders null when tasks array is empty', () => {
    const { container } = render(
      <LaterTodaySection tasks={[]} projects={[]} focusTasks={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders collapsed by default with task count', () => {
    render(<LaterTodaySection tasks={[makeTask(1), makeTask(2)]} projects={[]} focusTasks={[]} />);
    expect(screen.getByText('Later Today')).toBeInTheDocument();
    expect(screen.getByText('· 2 tasks')).toBeInTheDocument();
    expect(screen.queryByText('Later Task 1')).not.toBeInTheDocument();
  });

  it('shows singular "task" when count is 1', () => {
    render(<LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[]} />);
    expect(screen.getByText('· 1 task')).toBeInTheDocument();
  });

  it('expands and shows task titles when header is clicked', () => {
    render(<LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[]} />);
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.getByText('Later Task 1')).toBeInTheDocument();
  });

  it('collapses again when header is clicked twice', () => {
    render(<LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[]} />);
    fireEvent.click(screen.getByText('Later Today'));
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.queryByText('Later Task 1')).not.toBeInTheDocument();
  });

  it('shows + Focus button when fewer than 6 focus tasks', () => {
    render(
      <LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[makeFocusTask(1)]} />
    );
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.getByText('+ Focus')).toBeInTheDocument();
  });

  it('hides + Focus button when 6 focus tasks exist', () => {
    const focusTasks = Array.from({ length: 6 }, (_, i) => makeFocusTask(i + 1));
    render(
      <LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={focusTasks} />
    );
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.queryByText('+ Focus')).not.toBeInTheDocument();
  });
});
