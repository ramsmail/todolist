// Tables without a deleted_at column. The upload connectors normally turn a
// local DELETE into a soft delete (UPDATE ... SET deleted_at); for these tables
// that would fail with 42703 and, since 42xxx is not a fatal code, block the
// upload queue forever. Connectors must issue a real DELETE instead.
export const HARD_DELETE_TABLES = ['links'] as const;

export function isHardDeleteTable(table: string): boolean {
  return (HARD_DELETE_TABLES as readonly string[]).includes(table);
}
