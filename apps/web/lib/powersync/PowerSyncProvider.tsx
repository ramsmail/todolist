'use client';

import { PropsWithChildren, useEffect, useRef } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { getPowerSyncDb } from './database';
import { WebConnector } from './WebConnector';

export function PowerSyncProvider({ children }: PropsWithChildren) {
  const db        = useRef(getPowerSyncDb());
  const connector = useRef(new WebConnector());

  useEffect(() => {
    db.current.connect(connector.current);
    return () => { db.current.disconnect(); };
  }, []);

  return (
    <PowerSyncContext.Provider value={db.current}>
      {children}
    </PowerSyncContext.Provider>
  );
}
