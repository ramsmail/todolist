import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_DURATION = 25 * 60; // 25 minutes in seconds

export interface PomodoroState {
  timeRemaining: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setTimeRemaining: (time: number) => void;
  displayTime: string;
}

/**
 * Hook managing pomodoro timer state and logic.
 * Timer runs independently of component lifecycle (via Context in a future task).
 * Accurate timing: uses timestamps to detect actual elapsed time, not interval drift.
 */
export function usePomodoro(): PomodoroState {
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef(DEFAULT_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayTime = useCallback((): string => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [timeRemaining]);

  const setTimeRemainingCb = useCallback((time: number) => {
    setTimeRemaining(time);
    pausedTimeRef.current = time;
  }, []);

  const start = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    startTimeRef.current = Date.now();
    // pausedTimeRef is the base for this run; pause(), reset() and setTimeRemaining keep it current.

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current === null) return;

      const elapsedMs = Date.now() - startTimeRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const newTimeRemaining = Math.max(0, pausedTimeRef.current - elapsedSeconds);

      setTimeRemaining(newTimeRemaining);

      if (newTimeRemaining === 0) {
        setIsRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 100);
  }, [isRunning]);

  const pause = useCallback(() => {
    if (!isRunning) return;

    // Snapshot the exact remaining time so the next start() resumes from it.
    const startedAt = startTimeRef.current;
    const elapsedSeconds = startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, pausedTimeRef.current - elapsedSeconds);

    setIsRunning(false);
    setTimeRemaining(remaining);
    pausedTimeRef.current = remaining;
    startTimeRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isRunning]);

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setTimeRemaining(DEFAULT_DURATION);
    startTimeRef.current = null;
    pausedTimeRef.current = DEFAULT_DURATION;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    timeRemaining,
    isRunning,
    start,
    pause,
    reset,
    setTimeRemaining: setTimeRemainingCb,
    displayTime: displayTime(),
  };
}
