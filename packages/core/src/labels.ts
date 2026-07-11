/**
 * Safely parses the JSON-array-of-strings shape tasks.labels is stored as.
 *
 * Tolerates double-encoding: PowerSync mirrors the Postgres `jsonb` labels
 * column into a local `text` column, and the jsonb round-trip serializes the
 * array back as a JSON *string* (e.g. `"[\"guitar\"]"`). We therefore parse
 * repeatedly while the result is still a string until we reach the array.
 */
export function parseLabelsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    let parsed: unknown = JSON.parse(raw);
    // Unwrap up to a couple of extra JSON-string layers from jsonb round-trips.
    for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
      parsed = JSON.parse(parsed);
    }
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Combines label lists, de-duping case-insensitively while keeping first-seen order. */
export function mergeLabels(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const label of list) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}
