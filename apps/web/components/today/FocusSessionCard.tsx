'use client';

import { useFocusSession, type FocusTask } from '@/lib/focus/FocusSessionContext';

function fmt(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

interface Props { focusTasks: FocusTask[]; }

export function FocusSessionCard({ focusTasks }: Props) {
  const { isRunning, secondsLeft, queue, start, pause, reset } = useFocusSession();
  const qLen = isRunning ? queue.length : focusTasks.length;

  return (
    <div className="bg-surface-alt rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Focus Session</p>
      <p className="text-5xl font-mono font-bold text-text-primary leading-none">{fmt(secondsLeft)}</p>
      <p className="text-xs text-text-muted">
        {qLen} task{qLen !== 1 ? 's' : ''} queued · no distractions
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => isRunning ? pause() : start(focusTasks)}
          className="flex-1 bg-accent text-white text-sm font-semibold py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          {isRunning ? 'Pause' : 'Start focusing'}
        </button>
        {secondsLeft < 25 * 60 && (
          <button
            onClick={reset}
            className="px-3 py-2 text-xs text-text-muted hover:text-text-secondary border border-border rounded-xl transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
