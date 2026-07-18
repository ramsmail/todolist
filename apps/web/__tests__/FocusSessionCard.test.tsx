import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusSessionProvider, useFocusSession } from '@/lib/focus/FocusSessionContext';
import { FocusSessionCard } from '@/components/today/FocusSessionCard';

const mockTasks = [
  { id: '1', title: 'Task A' },
  { id: '2', title: 'Task B' },
];

function StartSessionButton() {
  const { selectTask, start } = useFocusSession();
  return (
    <button onClick={() => { selectTask({ id: '1', title: 'Task A' }); start(); }}>
      start-session
    </button>
  );
}

describe('FocusSessionCard', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the in-focus task count when idle', () => {
    render(
      <FocusSessionProvider>
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    expect(screen.getByText('2 tasks in focus · no distractions')).toBeInTheDocument();
  });

  it('links "Start focusing" to /focus when idle', () => {
    render(
      <FocusSessionProvider>
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    const link = screen.getByText('Start focusing').closest('a');
    expect(link).toHaveAttribute('href', '/focus');
  });

  it('shows a resume link with time left once a session is active', () => {
    render(
      <FocusSessionProvider>
        <StartSessionButton />
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    act(() => { screen.getByText('start-session').click(); });
    const link = screen.getByText('Resume — 25:00 left').closest('a');
    expect(link).toHaveAttribute('href', '/focus');
    expect(screen.queryByText('Start focusing')).not.toBeInTheDocument();
  });

  it('updates the resume time left as the session counts down', () => {
    render(
      <FocusSessionProvider>
        <StartSessionButton />
        <FocusSessionCard focusTasks={mockTasks} />
      </FocusSessionProvider>
    );
    act(() => { screen.getByText('start-session').click(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Resume — 24:55 left')).toBeInTheDocument();
  });
});
