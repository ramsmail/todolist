// apps/mobile/src/notifications/checkinContent.ts
//
// Copy and time parsing for the daily check-in alert. Pure functions so they
// are unit-testable without Expo.

export const CHECKIN_LINES = [
  'Time to plan your day ☀️',
  'Your tasks miss you 👀',
  'Two minutes now saves an hour later. Open your list ✅',
  "What's the one thing that matters today? 🎯",
  "Quick check-in: what's on your plate? 📝",
  'Small steps, every day. Take a look 🚶',
] as const;

export const DEFAULT_CHECKIN_TIME = '10:00';

// Indexed by local calendar day so the line is stable within a day and
// changes the next day. Date.UTC on local Y/M/D gives a DST-proof day number.
export function pickCheckinLine(date: Date): string {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return CHECKIN_LINES[dayNumber % CHECKIN_LINES.length];
}

// The DAILY trigger needs numeric hour/minute; a malformed stored value would
// otherwise produce NaN and silently schedule nothing.
export function normalizeCheckinTime(time: string | null | undefined): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return match ? time! : DEFAULT_CHECKIN_TIME;
}
