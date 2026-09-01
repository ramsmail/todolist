import React, { createContext, useContext, ReactNode } from 'react';
import { usePomodoro as useTimerHook, type PomodoroState } from '../hooks/usePomodoro';

type PomodoroContextValue = PomodoroState;

const PomodoroContext = createContext<PomodoroContextValue | undefined>(undefined);

/**
 * Provider that wraps the entire app to manage timer state globally.
 * The timer persists as the user navigates between screens.
 */
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const timerState = useTimerHook();

  return (
    <PomodoroContext.Provider value={timerState}>
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
