'use client';

import Link from 'next/link';
import { useFocusSession, type FocusTask } from '@/lib/focus/FocusSessionContext';

function fmt(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

interface Props { focusTasks: FocusTask[]; }

export function FocusSessionCard({ focusTasks }: Props) {
  const { phase, secondsLeft } = useFocusSession();
  const active = phase !== 'idle';

  return (
    <div className="focus-session-card rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Focus Session</p>
      {active ? (
        <>
          <p className="text-5xl font-mono font-bold text-text-primary leading-none">{fmt(secondsLeft)}</p>
          <p className="text-xs text-text-muted">no distractions</p>
          <Link
            href="/focus"
            className="flex-1 bg-accent text-white text-sm font-semibold py-2 rounded-xl hover:bg-accent-dark transition-colors text-center"
          >
            {`Resume — ${fmt(secondsLeft)} left`}
          </Link>
        </>
      ) : (
        <>
          <p className="text-5xl font-mono font-bold text-text-primary leading-none">25:00</p>
          <p className="text-xs text-text-muted">
            {focusTasks.length} task{focusTasks.length !== 1 ? 's' : ''} in focus · no distractions
          </p>
          <Link
            href="/focus"
            className="flex-1 bg-accent text-white text-sm font-semibold py-2 rounded-xl hover:bg-accent-dark transition-colors text-center"
          >
            Start focusing
          </Link>
        </>
      )}
    </div>
  );
}
