'use client';

import { usePendingNoteEnricher } from '@/hooks/usePendingNoteEnricher';

export function NoteEnricherRunner() {
  usePendingNoteEnricher();
  return null;
}
