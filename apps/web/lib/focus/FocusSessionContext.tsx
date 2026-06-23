'use client';

import {
  createContext, useContext, useState, useRef, useCallback, type ReactNode,
} from 'react';

export interface FocusTask { id: string; title: string; }

interface FocusSessionState {
  isRunning:   boolean;
  secondsLeft: number;
  queue:       FocusTask[];
  start:       (tasks: FocusTask[]) => void;
  pause:       () => void;
  reset:       () => void;
}

const Ctx = createContext<FocusSessionState | null>(null);

const POMODORO = 25 * 60;

export function FocusSessionProvider({ children }: { children: ReactNode }) {
  const [isRunning,   setIsRunning]   = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(POMODORO);
  const [queue,       setQueue]       = useState<FocusTask[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((tasks: FocusTask[]) => {
    setQueue(tasks);
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setSecondsLeft(POMODORO);
  }, []);

  return (
    <Ctx.Provider value={{ isRunning, secondsLeft, queue, start, pause, reset }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFocusSession(): FocusSessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFocusSession must be used within FocusSessionProvider');
  return ctx;
}
