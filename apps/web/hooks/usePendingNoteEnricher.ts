'use client';

import { useEffect } from 'react';
import { usePowerSync } from '@powersync/react';
import { invokeEnrichUrl } from '@/lib/notes/enrichUrl';
import { enrichState, runPendingEnrichment } from '@/lib/notes/enrichPending';

// Retries previews that were created offline: runs whenever the connection
// comes up (and once on mount if already connected).
export function usePendingNoteEnricher() {
  const db = usePowerSync();

  useEffect(() => {
    let wasConnected = false;
    const onStatus = () => {
      const connected = !!db.currentStatus?.connected;
      if (connected && !wasConnected) {
        void runPendingEnrichment(db as any, invokeEnrichUrl, enrichState);
      }
      wasConnected = connected;
    };
    onStatus();
    const unsubscribe = db.registerListener({ statusChanged: onStatus });
    return () => unsubscribe();
  }, [db]);
}
