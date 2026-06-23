import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusSessionProvider } from '@/lib/focus/FocusSessionContext';
import { FocusSessionCard } from '@/components/today/FocusSessionCard';

const mockTasks = [
  { id: '1', title: 'Task A' },
  { id: '2', title: 'Task B' },
];

describe('FocusSessionCard', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows 25:00 timer by default', () => {
    render(
      <FocusSessionProvider>
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('shows task queue count', () => {
    render(
      <FocusSessionProvider>
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    expect(screen.getByText('2 tasks queued · no distractions')).toBeInTheDocument();
  });

  it('shows "Start focusing" button when idle', () => {
    render(
      <FocusSessionProvider>
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    expect(screen.getByText('Start focusing')).toBeInTheDocument();
  });

  it('shows "Pause" after clicking Start', () => {
    render(
      <FocusSessionProvider>
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    const startBtn = screen.getByText('Start focusing');
    act(() => { startBtn.click(); });
    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.queryByText('Start focusing')).not.toBeInTheDocument();
  });
});
