'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { createNote } from '@todolist/db';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useNewNote() {
  const db = usePowerSync();
  const router = useRouter();
  const { userId } = useCurrentUser();

  return useCallback(
    async (opts: { projectId?: string | null } = {}): Promise<string | null> => {
      if (!userId) return null;
      const id = await createNote(db as any, { userId, projectId: opts.projectId ?? null });
      router.push(`/notes/${id}`);
      return id;
    },
    [db, router, userId]
  );
}
