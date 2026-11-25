'use client';

interface Props {
  total: number;
  completed: number;
  focusSeconds: number;
}

const R = 20;
const CIRCUMFERENCE = 2 * Math.PI * R;

function formatFocusTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Ring({
  fill, color, innerLabel, outerLabel,
}: {
  fill: number; color: string; innerLabel: string; outerLabel: string;
}) {
  const clampedFill = Math.max(0, Math.min(1, fill));
  const offset = CIRCUMFERENCE * (1 - clampedFill);
  return (
    <div className="flex flex-col items-center gap-2 flex-1 bg-white rounded-xl p-4">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle cx="24" cy="24" r={R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="24" cy="24" r={R} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-gray-800">{innerLabel}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">{outerLabel}</p>
    </div>
  );
}

export function TodayStatsRow({ total, completed, focusSeconds }: Props) {
  const taskFill = total > 0 ? completed / total : 0;
  const focusFill = Math.min(focusSeconds / (4 * 3600), 1);

  return (
    <div className="flex gap-3">
      <Ring
        fill={taskFill}
        color="#6366f1"
        innerLabel={`${completed}/${total}`}
        outerLabel="Tasks Done"
      />
      <Ring
        fill={focusFill}
        color="#ca8a04"
        innerLabel={formatFocusTime(focusSeconds)}
        outerLabel="Focus Time"
      />
    </div>
  );
}
