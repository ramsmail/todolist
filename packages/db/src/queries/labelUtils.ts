const PALETTE = [
  '#6366F1', '#10B981', '#EF4444', '#F59E0B',
  '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6',
];

export function pickLabelColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function renameInLabelArray(labels: string[], from: string, to: string): string[] {
  return Array.from(new Set(labels.map((l) => (l === from ? to : l))));
}

export function removeFromLabelArray(labels: string[], name: string): string[] {
  return labels.filter((l) => l !== name);
}
