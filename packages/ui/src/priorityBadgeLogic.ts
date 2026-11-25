export function shouldRenderPriorityBadge(
  priority: 1 | 2 | 3 | 4,
  interactive: boolean
): boolean {
  if (interactive) return true;
  return priority !== 4;
}
