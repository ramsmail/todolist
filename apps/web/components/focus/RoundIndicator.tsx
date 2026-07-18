import { TOTAL_ROUNDS } from '@/lib/focus/FocusSessionContext';

interface Props {
  round:           number;
  durationMinutes: number;
}

export function RoundIndicator({ round, durationMinutes }: Props) {
  return (
    <p className="focus-mode-round">
      Round <b>{round}</b> / {TOTAL_ROUNDS} · Duration: {durationMinutes} min
    </p>
  );
}
