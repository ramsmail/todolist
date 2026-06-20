export const colors = {
  // Brand
  accent:       '#6366F1',  // electric indigo
  accentDark:   '#4F46E5',

  // Priority
  p1:           '#EF4444',  // red
  p2:           '#F97316',  // orange
  p3:           '#3B82F6',  // blue
  p4:           '#9CA3AF',  // grey — WCAG AA on dark bg

  // Neutral
  bg:           '#0A0A0A',
  surface:      '#141414',
  surfaceAlt:   '#1C1C1C',
  border:       '#272727',
  textPrimary:  '#F9FAFB',
  textSecondary:'#9CA3AF',
  textMuted:    '#6B7280',

  // Status
  success:      '#22C55E',
  warning:      '#F59E0B',
  error:        '#EF4444',
} as const;

export type ColorKey = keyof typeof colors;

export const priorityColor: Record<1 | 2 | 3 | 4, string> = {
  1: colors.p1,
  2: colors.p2,
  3: colors.p3,
  4: colors.p4,
};

export const priorityLabel: Record<1 | 2 | 3 | 4, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
};

export const typography = {
  heading1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading2: { fontSize: 22, fontWeight: '600' as const },
  heading3: { fontSize: 18, fontWeight: '600' as const },
  body:     { fontSize: 15, fontWeight: '400' as const },
  caption:  { fontSize: 12, fontWeight: '400' as const },
} as const;
