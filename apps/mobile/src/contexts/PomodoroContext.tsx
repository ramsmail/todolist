import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePomodoro as useTimerHook, type PomodoroState } from '../hooks/usePomodoro';

type PomodoroContextValue = Pick<
  PomodoroState,
  'displayTime' | 'isRunning' | 'start' | 'pause' | 'reset'
>;

const PomodoroContext = createContext<PomodoroContextValue | undefined>(undefined);

/**
 * Provider that wraps the entire app to manage timer state globally.
 * The timer persists as the user navigates between screens.
 */
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const timerState = useTimerHook();

  const value = useMemo<PomodoroContextValue>(
    () => ({
      displayTime: timerState.displayTime,
      isRunning: timerState.isRunning,
      start: timerState.start,
      pause: timerState.pause,
      reset: timerState.reset,
    }),
    [
      timerState.displayTime,
      timerState.isRunning,
      timerState.start,
      timerState.pause,
      timerState.reset,
    ]
  );

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

/**
 * Custom hook to access the pomodoro timer from any component.
 * Must be used inside a PomodoroProvider.
 *
 * @throws Error if used outside PomodoroProvider
 * @returns Timer state and control methods
 */
export function usePomodoro(): PomodoroContextValue {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error(
      'usePomodoro must be used within PomodoroProvider. ' +
        'Make sure the app root is wrapped with <PomodoroProvider>.'
    );
  }
  return context;
}
