import React, { useEffect } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { db } from './database';
import { SupabaseConnector } from './SupabaseConnector';
import { useAuth } from '../auth/AuthContext';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      db.connect(new SupabaseConnector()).catch(console.error);
    } else {
      db.disconnect().catch(console.error);
    }
  }, [session?.access_token]);

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
}
