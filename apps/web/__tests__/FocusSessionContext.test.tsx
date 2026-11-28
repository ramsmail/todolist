import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusSessionProvider, useFocusSession } from '@/lib/focus/FocusSessionContext';

function TestConsumer() {
  const {
    phase, round, isRunning, secondsLeft, activeTask, selectTask, start, pause, reset, skip,
  } = useFocusSession();
  return (
    <div>
      <span data-testid="phase">{phase}</span>
      <span data-testid="round">{round}</span>
      <span data-testid="running">{String(isRunning)}</span>
      <span data-testid="seconds">{secondsLeft}</span>
      <span data-testid="task">{activeTask?.title ?? ''}</span>
      <button onClick={() => selectTask({ id: '1', title: 'Task A' })}>select</button>
      <button onClick={start}>start</button>
      <button onClick={pause}>pause</button>
      <button onClick={reset}>reset</button>
      <button onClick={skip}>skip</button>
    </div>
  );
}

function renderConsumer() {
  render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
}

const select      = () => act(() => { screen.getByText('select').click(); });
const startTimer  = () => act(() => { screen.getByText('start').click(); });
const selectAndStart = () => { select(); startTimer(); };
const advance     = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('FocusSessionContext', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts idle at round 1 with a full 25:00 and not running', () => {
    renderConsumer();
    expect(screen.getByTestId('phase').textContent).toBe('idle');
    expect(screen.getByTestId('round').textContent).toBe('1');
    expect(screen.getByTestId('running').textContent).toBe('false');
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
  });

  it('selectTask() sets the active task and readies a focus phase without running', () => {
    renderConsumer();
    select();
    expect(screen.getByTestId('phase').textContent).toBe('focus');
    expect(screen.getByTestId('task').textContent).toBe('Task A');
    expect(screen.getByTestId('running').textContent).toBe('false');
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
  });

  it('start() has no effect until a task has been selected', () => {
    renderConsumer();
    startTimer();
    expect(screen.getByTestId('running').textContent).toBe('false');
    expect(screen.getByTestId('phase').textContent).toBe('idle');
  });

  it('start() begins counting down once a task is selected', () => {
    renderConsumer();
    selectAndStart();
    expect(screen.getByTestId('running').textContent).toBe('true');
  });

  it('counts down every second while running', () => {
    renderConsumer();
    selectAndStart();
    advance(3000);
    expect(screen.getByTestId('seconds').textContent).toBe('1497');
  });

  it('pause() stops the countdown', () => {
    renderConsumer();
    selectAndStart();
    advance(2000);
    act(() => { screen.getByText('pause').click(); });
    advance(5000);
    expect(screen.getByTestId('running').textContent).toBe('false');
    expect(screen.getByTestId('seconds').textContent).toBe('1498');
  });

  it('start() resumes a paused session from where it left off', () => {
    renderConsumer();
    selectAndStart();
    advance(2000);
    act(() => { screen.getByText('pause').click(); });
    startTimer();
    expect(screen.getByTestId('running').textContent).toBe('true');
    expect(screen.getByTestId('seconds').textContent).toBe('1498');
    advance(1000);
    expect(screen.getByTestId('seconds').textContent).toBe('1497');
  });

  it('reset() restores the current phase to its full duration and stops', () => {
    renderConsumer();
    selectAndStart();
    advance(10000);
    act(() => { screen.getByText('reset').click(); });
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
    expect(screen.getByTestId('running').textContent).toBe('false');
  });

  it('advances focus -> short break when a focus round (1-3) completes', () => {
    renderConsumer();
    selectAndStart();
    advance(1500 * 1000);
    expect(screen.getByTestId('phase').textContent).toBe('shortBreak');
    expect(screen.getByTestId('round').textContent).toBe('1');
    expect(screen.getByTestId('seconds').textContent).toBe('300');
    expect(screen.getByTestId('running').textContent).toBe('true');
  });

  it('advances short break -> next focus round when the break completes', () => {
    renderConsumer();
    selectAndStart();
    advance(1500 * 1000); // focus round 1 completes -> short break
    advance(300 * 1000);  // short break completes -> focus round 2
    expect(screen.getByTestId('phase').textContent).toBe('focus');
    expect(screen.getByTestId('round').textContent).toBe('2');
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
  });

  it('advances to a long break after focus round 4 completes', () => {
    renderConsumer();
    selectAndStart();
    // rounds 1-3: focus -> short break -> focus -> short break -> focus -> short break
    advance(1500 * 1000);
    advance(300 * 1000);
    advance(1500 * 1000);
    advance(300 * 1000);
    advance(1500 * 1000);
    advance(300 * 1000);
    // round 4 focus
    advance(1500 * 1000);
    expect(screen.getByTestId('phase').textContent).toBe('longBreak');
    expect(screen.getByTestId('round').textContent).toBe('4');
    expect(screen.getByTestId('seconds').textContent).toBe('900');
  });

  it('returns to idle at round 1 once the long break completes', () => {
    renderConsumer();
    selectAndStart();
    advance(1500 * 1000);
    advance(300 * 1000);
    advance(1500 * 1000);
    advance(300 * 1000);
    advance(1500 * 1000);
    advance(300 * 1000);
    advance(1500 * 1000); // round 4 focus -> long break
    advance(900 * 1000);  // long break completes -> idle
    expect(screen.getByTestId('phase').textContent).toBe('idle');
    expect(screen.getByTestId('round').textContent).toBe('1');
    expect(screen.getByTestId('running').textContent).toBe('false');
  });

  it('skip() advances immediately to the next phase without waiting', () => {
    renderConsumer();
    selectAndStart();
    act(() => { screen.getByText('skip').click(); });
    expect(screen.getByTestId('phase').textContent).toBe('shortBreak');
    expect(screen.getByTestId('seconds').textContent).toBe('300');
  });
});
