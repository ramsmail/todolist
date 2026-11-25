'use client';

interface Props { completed: number; total: number; }

function DonutChart({ completed, total }: Props) {
  const pct = total === 0 ? 0 : completed / total;
  const r = 28;
  const circ = 2 * Math.PI * r;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="currentColor" strokeWidth="8"
        className="text-border"
      />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="currentColor" strokeWidth="8"
        className="text-accent"
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="33" textAnchor="middle" fill="#F9FAFB" fontSize="11" fontWeight="bold">
        {completed}/{total}
      </text>
      <text x="36" y="46" textAnchor="middle" fill="#6B7280" fontSize="9">
        done
      </text>
    </svg>
  );
}

export function TodayProgressCard({ completed, total }: Props) {
  const now = new Date();
  const dayFraction = (now.getHours() + now.getMinutes() / 60) / 24;
  const taskFraction = total === 0 ? 1 : completed / total;
  const onPace = taskFraction >= dayFraction;
  const remaining = total - completed;

  return (
    <div className="bg-surface rounded-2xl p-4 flex items-center gap-3 border border-border">
      <DonutChart completed={completed} total={total} />
      <div>
        <p className="text-sm font-semibold text-text-primary">Today's progress</p>
        <p className="text-xs text-text-muted mt-1">
          {onPace
            ? 'On pace — keep going!'
            : `${remaining} task${remaining !== 1 ? 's' : ''} left to hit your goal.`}
        </p>
      </div>
    </div>
  );
}
