import { useQuery } from '@powersync/react';

export interface DayActivity {
  day: string;
  count: number;
}

export function useWeeklyActivity(): DayActivity[] {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday
  const offsetToMonday = (dow + 6) % 7;

  const monday = new Date(today);
  monday.setDate(today.getDate() - offsetToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monStr = monday.toISOString().split('T')[0];
  const friStr = friday.toISOString().split('T')[0];

  const { data } = useQuery<DayActivity>(
    `SELECT date(updated_at) as day, COUNT(*) as count
     FROM tasks
     WHERE status = 'completed'
       AND deleted_at IS NULL
       AND date(updated_at) >= ?
       AND date(updated_at) <= ?
     GROUP BY date(updated_at)`,
    [monStr, friStr]
  );

  const countMap = new Map(data.map(r => [r.day, Number(r.count)]));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const day = d.toISOString().split('T')[0];
    return { day, count: countMap.get(day) ?? 0 };
  });
}
