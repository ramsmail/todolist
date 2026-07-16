export const REMINDER_OFFSET_MINUTES = {
  due: 0,
  '10min': 10,
  '30min': 30,
  '1hour': 60,
} as const;

export type ReminderOffsetKey = keyof typeof REMINDER_OFFSET_MINUTES;

export function formatReminderLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// dueDate: 'YYYY-MM-DD', dueTime: 'HH:mm', both interpreted as local wall-clock
// time on this device (single-device personal app — see design spec's data
// model notes on `timezone`). offsetMinutes is subtracted from the due instant.
export function computeReminderFromOffset(
  dueDate: string,
  dueTime: string,
  offsetMinutes: number
): { remindAtLocal: string; remindAtUtc: string } {
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = dueTime.split(':').map(Number);
  const dueInstant = new Date(year, month - 1, day, hour, minute);
  const remindInstant = new Date(dueInstant.getTime() - offsetMinutes * 60000);
  return {
    remindAtLocal: formatReminderLocal(remindInstant),
    remindAtUtc: remindInstant.toISOString(),
  };
}

export function computeReminderFromCustomDate(date: Date): { remindAtLocal: string; remindAtUtc: string } {
  return {
    remindAtLocal: formatReminderLocal(date),
    remindAtUtc: date.toISOString(),
  };
}
