import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));
vi.mock('@todolist/db', () => ({
  completeTask: vi.fn(),
  moveTask: vi.fn(),
  toggleFocus: vi.fn(),
}));
vi.mock('fractional-indexing', () => ({
  generateKeyBetween: vi.fn(() => 'new-key'),
}));

import { IvyLeeList } from '@/components/today/IvyLeeList';

const makeTask = (n: number) => ({
  id: `t${n}`, title: `Task ${n}`, priority: 1,
  sort_order: `a${n}`, project_id: null, status: 'active', in_focus: 1,
});

describe('IvyLeeList', () => {
  it('renders Top Priorities heading', () => {
    render(<IvyLeeList tasks={[]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getByText('Top Priorities')).toBeInTheDocument();
  });

  it('renders 6 empty dashes when no tasks', () => {
    render(<IvyLeeList tasks={[]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText('—')).toHaveLength(6);
  });

  it('renders 4 empty slots when 2 tasks provided', () => {
    render(<IvyLeeList tasks={[makeTask(1), makeTask(2)]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('renders NOW badge on slot 1 only', () => {
    render(<IvyLeeList tasks={[makeTask(1), makeTask(2)]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText('NOW')).toHaveLength(1);
  });

  it('does not render NOW badge when no tasks', () => {
    render(<IvyLeeList tasks={[]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.queryByText('NOW')).not.toBeInTheDocument();
  });

  it('calls onOpenDetail when task title is clicked', () => {
    const onOpenDetail = vi.fn();
    render(<IvyLeeList tasks={[makeTask(1)]} projects={[]} onOpenDetail={onOpenDetail} />);
    fireEvent.click(screen.getByText('Task 1'));
    expect(onOpenDetail).toHaveBeenCalledWith('t1');
  });

  it('renders slot numbers 1-6', () => {
    render(<IvyLeeList tasks={[makeTask(1)]} projects={[]} onOpenDetail={vi.fn()} />);
    ['1', '2', '3', '4', '5', '6'].forEach(n => {
      expect(screen.getByText(n)).toBeInTheDocument();
    });
  });
});
