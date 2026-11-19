// parseTaskInput's silent default when no "pN" tag is present in the text.
const PARSER_SILENT_DEFAULT = 4;

// Priority for new tasks captured without a quadrant context (Home FAB, share
// sheet). P2 = Plan: the "important, not urgent" bucket new captures belong in.
export const CAPTURE_DEFAULT_PRIORITY = 2;

export function resolveTaskPriority(
  parsedPriority: 1 | 2 | 3 | 4,
  defaultPriority: 1 | 2 | 3 | 4 | undefined
): 1 | 2 | 3 | 4 {
  if (parsedPriority !== PARSER_SILENT_DEFAULT) return parsedPriority;
  return defaultPriority ?? parsedPriority;
}
