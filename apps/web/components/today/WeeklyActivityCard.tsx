'use client';

import { useWeeklyActivity } from '@todolist/db';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F'];

export function WeeklyActivityCard() {
  const activity = useWeeklyActivity();
  const maxCount = Math.max(1, ...activity.map(d => d.count));
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">This Week</p>
      <div className="flex items-end gap-2 h-12">
        {activity.map((d, i) => {
          const isToday = d.day === todayStr;
          const heightPct = d.count === 0 ? 8 : Math.round((d.count / maxCount) * 100);
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className={`w-full rounded-sm transition-all ${isToday ? 'bg-accent' : 'bg-border'}`}
                style={{ height: `${heightPct}%` }}
                aria-label={`${DAY_LABELS[i]}: ${d.count} tasks completed`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="flex-1 text-center text-xs text-text-muted">{l}</div>
        ))}
      </div>
    </div>
  );
}
