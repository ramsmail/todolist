import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusSessionProvider, useFocusSession } from '@/lib/focus/FocusSessionContext';

function TestConsumer() {
  const { isRunning, secondsLeft, queue, start, pause, reset } = useFocusSession();
  return (
    <div>
      <span data-testid="running">{String(isRunning)}</span>
      <span data-testid="seconds">{secondsLeft}</span>
      <span data-testid="queue">{queue.length}</span>
      <button onClick={() => start([{ id: '1', title: 'Task A' }])}>start</button>
      <button onClick={pause}>pause</button>
      <button onClick={reset}>reset</button>
    </div>
  );
}

describe('FocusSessionContext', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with 25:00 and not running', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    expect(screen.getByTestId('running').textContent).toBe('false');
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
  });

  it('start() sets isRunning and seeds queue', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    expect(screen.getByTestId('running').textContent).toBe('true');
    expect(screen.getByTestId('queue').textContent).toBe('1');
  });

  it('counts down every second', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('seconds').textContent).toBe('1497');
  });

  it('pause() stops countdown', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => { screen.getByText('pause').click(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('seconds').textContent).toBe('1498');
  });

  it('reset() restores 1500 and stops', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    act(() => { vi.advanceTimersByTime(10000); });
    act(() => { screen.getByText('reset').click(); });
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
    expect(screen.getByTestId('running').textContent).toBe('false');
  });
});
