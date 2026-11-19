import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { usePomodoro } from '../src/hooks/usePomodoro';

describe('usePomodoro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('initializes with 25 minutes (1500 seconds) and stopped state', () => {
    const { result } = renderHook(() => usePomodoro());
    expect(result.current.timeRemaining).toBe(1500);
    expect(result.current.isRunning).toBe(false);
  });

  it('starts the timer when start() is called', () => {
    const { result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);
  });

  it('pauses the timer when pause() is called', () => {
    const { result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('decrements timeRemaining by 1 second every 1000ms when running', () => {
    const { result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.timeRemaining).toBeLessThan(1500);
  });

  it('resets to 1500 seconds and stopped state when reset() is called', () => {
    const { result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.timeRemaining).toBe(1500);
    expect(result.current.isRunning).toBe(false);
  });

  it('stops decrementing when timeRemaining reaches 0', () => {
    const { result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.setTimeRemaining(2);
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.timeRemaining).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it('formats timeRemaining as MM:SS string', () => {
    const { result } = renderHook(() => usePomodoro());
    expect(result.current.displayTime).toBe('25:00');

    act(() => {
      result.current.setTimeRemaining(125);
    });

    expect(result.current.displayTime).toBe('02:05');
  });

  it('resumes from the paused value after multiple pause/resume cycles', () => {
    const { result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    act(() => {
      result.current.pause();
    });
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    act(() => {
      result.current.pause();
    });

    const pausedAt = result.current.timeRemaining;
    expect(pausedAt).toBe(1380);

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.timeRemaining).toBe(1379);
  });

  it('cleans up the interval on unmount', () => {
    const { unmount, result } = renderHook(() => usePomodoro());

    act(() => {
      result.current.start();
    });

    unmount();
  });
});
