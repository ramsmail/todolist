'use client';

import {
  createContext, useContext, useState, useRef, useCallback, type ReactNode,
} from 'react';

export interface FocusTask { id: string; title: string; }

export type FocusPhase = 'idle' | 'focus' | 'shortBreak' | 'longBreak';

export const FOCUS_SECONDS       = 25 * 60;
export const SHORT_BREAK_SECONDS = 5 * 60;
export const LONG_BREAK_SECONDS  = 15 * 60;
export const TOTAL_ROUNDS        = 4;

function durationFor(phase: FocusPhase): number {
  if (phase === 'shortBreak') return SHORT_BREAK_SECONDS;
  if (phase === 'longBreak')  return LONG_BREAK_SECONDS;
  return FOCUS_SECONDS;
}

function nextPhase(phase: FocusPhase, round: number): { phase: FocusPhase; round: number } {
  if (phase === 'focus') {
    return round >= TOTAL_ROUNDS
      ? { phase: 'longBreak', round }
      : { phase: 'shortBreak', round };
  }
  if (phase === 'shortBreak') return { phase: 'focus', round: round + 1 };
  if (phase === 'longBreak')  return { phase: 'idle', round: 1 };
  return { phase: 'focus', round };
}

function playChime() {
  try {
    void new Audio('/sounds/chime.mp3').play().catch(() => {});
  } catch {
    // Audio unsupported in this environment — no-op
  }
}

function notify(phase: FocusPhase) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const title = phase === 'focus' ? 'Focus round started'
    : phase === 'idle' ? 'Session complete'
    : 'Break time';
  try {
    new Notification(title);
  } catch {
    // Notification construction can throw in unsupported environments — no-op
  }
}

interface FocusSessionState {
  phase:       FocusPhase;
  round:       number;
  secondsLeft: number;
  isRunning:   boolean;
  activeTask:  FocusTask | null;
  selectTask:  (task: FocusTask) => void;
  start:       () => void;
  pause:       () => void;
  reset:       () => void;
  skip:        () => void;
}

const Ctx = createContext<FocusSessionState | null>(null);

export function FocusSessionProvider({ children }: { children: ReactNode }) {
  const [phase,       setPhase]       = useState<FocusPhase>('idle');
  const [round,       setRound]       = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning,   setIsRunning]   = useState(false);
  const [activeTask,  setActiveTask]  = useState<FocusTask | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef    = useRef(phase);
  const roundRef    = useRef(round);
  phaseRef.current = phase;
  roundRef.current = round;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const runTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s > 1) return s - 1;

        const { phase: p, round: r } = nextPhase(phaseRef.current, roundRef.current);
        setPhase(p);
        setRound(r);
        if (p === 'idle') {
          setIsRunning(false);
          clearTimer();
        } else {
          playChime();
          notify(p);
        }
        return durationFor(p);
      });
    }, 1000);
  }, [clearTimer]);

  const activeTaskRef = useRef<FocusTask | null>(null);

  const selectTask = useCallback((task: FocusTask) => {
    activeTaskRef.current = task;
    setActiveTask(task);
    clearTimer();
    setPhase('focus');
    setRound(1);
    setSecondsLeft(FOCUS_SECONDS);
    setIsRunning(false);
  }, [clearTimer]);

  const start = useCallback(() => {
    if (!activeTaskRef.current) return;
    setIsRunning(true);
    runTimer();
  }, [runTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setSecondsLeft(durationFor(phaseRef.current));
  }, [clearTimer]);

  const skip = useCallback(() => {
    const { phase: p, round: r } = nextPhase(phaseRef.current, roundRef.current);
    setPhase(p);
    setRound(r);
    setSecondsLeft(durationFor(p));
    if (p === 'idle') {
      clearTimer();
      setIsRunning(false);
    } else if (isRunning) {
      runTimer();
    }
  }, [clearTimer, runTimer, isRunning]);

  return (
    <Ctx.Provider value={{ phase, round, secondsLeft, isRunning, activeTask, selectTask, start, pause, reset, skip }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFocusSession(): FocusSessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFocusSession must be used within FocusSessionProvider');
  return ctx;
}
