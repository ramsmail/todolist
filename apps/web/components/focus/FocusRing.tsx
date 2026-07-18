import type { FocusPhase } from '@/lib/focus/FocusSessionContext';

function fmt(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function phaseLabel(phase: FocusPhase): string {
  if (phase === 'shortBreak') return 'Short Break';
  if (phase === 'longBreak')  return 'Long Break';
  return 'Focus Session';
}

interface Props {
  phase:        FocusPhase;
  secondsLeft:  number;
  totalSeconds: number;
}

export function FocusRing({ phase, secondsLeft, totalSeconds }: Props) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="focus-mode-ring">
      <svg width={192} height={192} viewBox="0 0 192 192">
        <circle cx={96} cy={96} r={radius} fill="none" strokeWidth={6} className="focus-mode-ring-track" />
        <circle
          cx={96}
          cy={96}
          r={radius}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          className="focus-mode-ring-progress"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 96 96)"
        />
      </svg>
      <div className="focus-mode-ring-content">
        <p className="focus-mode-ring-time">{fmt(secondsLeft)}</p>
        <p className="focus-mode-ring-label">{phaseLabel(phase)}</p>
      </div>
    </div>
  );
}
