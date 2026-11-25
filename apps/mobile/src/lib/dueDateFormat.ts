export function parseDueDate(dueDate: string | null): Date | null {
  if (!dueDate) return null;
  const [year, month, day] = dueDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDueDateForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
