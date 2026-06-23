import { render, screen } from '@testing-library/react';
import { TodayProgressCard } from '@/components/today/TodayProgressCard';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('TodayProgressCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays completed/total fraction correctly', () => {
    render(<TodayProgressCard completed={3} total={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('shows "On pace — keep going!" when on pace', () => {
    // Mock 6 AM (0.25 of day), task 2/4 completed (0.5 of tasks)
    vi.setSystemTime(new Date(2024, 0, 1, 6, 0, 0));
    render(<TodayProgressCard completed={2} total={4} />);
    expect(screen.getByText('On pace — keep going!')).toBeInTheDocument();
  });

  it('shows remaining task count when behind pace', () => {
    // Mock 6 PM (0.75 of day), only 1/4 task completed (0.25 of tasks)
    vi.setSystemTime(new Date(2024, 0, 1, 18, 0, 0));
    render(<TodayProgressCard completed={1} total={4} />);
    expect(screen.getByText('3 tasks left to hit your goal.')).toBeInTheDocument();
  });

  it('uses singular "task" when exactly one task remains', () => {
    // Mock 9 PM (0.875 of day), 3/4 tasks completed (0.75 of tasks)
    vi.setSystemTime(new Date(2024, 0, 1, 21, 0, 0));
    render(<TodayProgressCard completed={3} total={4} />);
    expect(screen.getByText('1 task left to hit your goal.')).toBeInTheDocument();
  });
});
