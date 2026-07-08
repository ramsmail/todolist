import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TodayStatsRow } from '@/components/today/TodayStatsRow';

describe('TodayStatsRow', () => {
  it('renders Tasks Done label', () => {
    render(<TodayStatsRow total={5} completed={2} focusSeconds={0} />);
    expect(screen.getByText('Tasks Done')).toBeInTheDocument();
  });

  it('renders task completion ratio inside ring', () => {
    render(<TodayStatsRow total={5} completed={3} focusSeconds={0} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders 0/0 when no tasks', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('renders Focus Time label', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={0} />);
    expect(screen.getByText('Focus Time')).toBeInTheDocument();
  });

  it('formats focus time in minutes when under 1 hour', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={600} />);
    expect(screen.getByText('10m')).toBeInTheDocument();
  });

  it('formats focus time with hours and minutes when >= 1 hour', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={3900} />);
    expect(screen.getByText('1h 5m')).toBeInTheDocument();
  });
});
