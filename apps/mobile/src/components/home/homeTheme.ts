// Self-contained LIGHT palette for the Home dashboard.
// The rest of the app is dark (see @todolist/ui `colors`); this screen is
// intentionally light per the design and does not touch the global tokens.
export const homeColors = {
  page:          '#FAFAFA',
  card:          '#FFFFFF',
  cardBorder:    '#ECECEC',

  textPrimary:   '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted:     '#9CA3AF',

  accent:        '#6366F1', // indigo (matches app accent)
  accentSoft:    '#EEF0FF',

  energy:        '#F59E0B', // amber
  energySoft:    '#FEF6E7',
  energyBorder:  '#F3D9A4',

  segmentBorder: '#E5E7EB',
  ringTrack:     '#ECECEC',
  sectionBg:     '#EFF0F2', // light track/chip background

  success:       '#22C55E',
} as const;

// Priority accent colours reused for the Top Priorities tint / rings.
export const homePriorityColor: Record<1 | 2 | 3 | 4, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#3B82F6',
  4: '#22C55E',
};

// Very light wash of the priority colour for the task-row background.
export function homeRowTint(priority: number | null | undefined): string {
  const key = (priority ?? 4) as 1 | 2 | 3 | 4;
  return `${homePriorityColor[key] ?? homePriorityColor[4]}12`; // ~7% alpha
}

export const homeSpace = {
  screen: 20,
  cardRadius: 16,
  gap: 12,
} as const;
