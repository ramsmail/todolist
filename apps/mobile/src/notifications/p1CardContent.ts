// Body text for a P1 notification card. Pure and native-module-free so the
// wording can be unit tested; the row type is declared here rather than
// imported from @todolist/db so the notification modules keep the structural
// boundary that PendingReminder already establishes in reconciliation.ts.

export interface P1CardTask {
  id:       string;
  title:    string;
  due_date: string | null;
  due_time: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-08-25" -> "25 Aug". The year is deliberately dropped: these cards only
// ever show work that is already due, so the year is noise in the shade.
function formatDay(dueDate: string): string {
  const [, month, day] = dueDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// `today` is passed in rather than read off the clock so this stays pure;
// callers pass formatDueDateForStorage(new Date()).
//
// P1_CARDS_QUERY guarantees due_date is non-null, but the null branch is kept
// so a future caller with a looser query gets a sane string instead of
// "Overdue — was due undefined NaN".
export function formatP1CardBody(task: P1CardTask, today: string): string {
  if (task.due_date == null) return 'Priority 1';

  if (task.due_date < today) {
    const day = formatDay(task.due_date);
    return task.due_time
      ? `Overdue — was due ${day} at ${task.due_time}`
      : `Overdue — was due ${day}`;
  }

  return task.due_time ? `Due today at ${task.due_time}` : 'Due today';
}
