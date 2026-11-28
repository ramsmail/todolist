import { useQuery } from '@powersync/react';

/** Pure function — testable without PowerSync context. */
export function computeStreak(
  daySet: Set<string>,
  today: string
): { count: number; days: boolean[] } {
  const days: boolean[] = [];

  // Parse today as YYYY-MM-DD and work with date arithmetic
  const todayDate = new Date(today);

  for (let i = 6; i >= 0; i--) {
    // Subtract i days from today
    const targetDate = new Date(todayDate);
    targetDate.setDate(targetDate.getDate() - i);

    // Format back to YYYY-MM-DD in local time
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const date = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${date}`;

    days.push(daySet.has(dateStr));
  }

  let count = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]) count++;
    else break;
  }
  return { count, days };
}

export function useStreak(): { count: number; days: boolean[] } {
  const { data } = useQuery<{ day: string }>(
    `SELECT DISTINCT date(updated_at) as day
     FROM tasks
     WHERE status = 'completed'
       AND deleted_at IS NULL
       AND date(updated_at) >= date('now', '-6 days')
     ORDER BY day DESC`
  );
  const daySet = new Set(data.map(r => r.day));
  const today = new Date().toISOString().split('T')[0];
  return computeStreak(daySet, today);
}
