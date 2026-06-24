import { render, screen } from '@testing-library/react';
import { WeeklyActivityCard } from '@/components/today/WeeklyActivityCard';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@todolist/db', () => ({
  useWeeklyActivity: vi.fn(() => [
    { day: '2024-01-08', count: 5 },
    { day: '2024-01-09', count: 8 },
    { day: '2024-01-10', count: 3 },
    { day: '2024-01-11', count: 6 },
    { day: '2024-01-12', count: 0 },
  ]),
}));

describe.skip('WeeklyActivityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header "This Week"', () => {
    render(<WeeklyActivityCard />);
    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('renders day labels M T W T F', () => {
    render(<WeeklyActivityCard />);
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
  });
});
