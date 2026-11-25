'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useAutosave<T>(save: (value: T) => Promise<void> | void, delay = 500) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const p = pending.current;
    if (!p) return Promise.resolve();
    pending.current = null;
    return Promise.resolve(saveRef.current(p.value));
  }, []);

  const schedule = useCallback((value: T) => {
    pending.current = { value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, delay);
  }, [delay, flush]);

  const isDirty = useCallback(() => pending.current !== null, []);

  useEffect(() => () => { void flush(); }, [flush]);

  return { schedule, flush, isDirty };
}
