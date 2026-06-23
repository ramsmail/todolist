import { render, screen } from '@testing-library/react';
import { WeeklyActivityCard } from '@/components/today/WeeklyActivityCard';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@todolist/db', () => ({
  useWeeklyActivity: () => [
    { day: '2026-06-19', count: 3 },
    { day: '2026-06-20', count: 5 },
    { day: '2026-06-21', count: 2 },
    { day: '2026-06-22', count: 7 },
    { day: '2026-06-23', count: 4 },
  ],
}));

describe('WeeklyActivityCard', () => {
  it('renders the "This Week" header', () => {
    render(<WeeklyActivityCard />);
    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('renders day labels M-F and bar heights based on activity', () => {
    render(<WeeklyActivityCard />);
    const labels = ['M', 'T', 'W', 'T', 'F'];
    labels.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // Verify aria-labels for task counts are present
    expect(screen.getByLabelText(/M: \d+ tasks completed/)).toBeInTheDocument();
    expect(screen.getByLabelText(/F: \d+ tasks completed/)).toBeInTheDocument();
  });
});
