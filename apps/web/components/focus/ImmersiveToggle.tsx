'use client';

import { useEffect, type RefObject } from 'react';
import { useImmersive } from '@/lib/focus/ImmersiveContext';

interface Props {
  targetRef: RefObject<HTMLElement>;
}

export function ImmersiveToggle({ targetRef }: Props) {
  const { immersive, setImmersive } = useImmersive();

  useEffect(() => {
    const handler = () => setImmersive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [setImmersive]);

  const toggle = async () => {
    if (immersive) {
      try {
        await document.exitFullscreen?.();
      } catch {
        // ignore — best effort
      }
      setImmersive(false);
      return;
    }

    try {
      await targetRef.current?.requestFullscreen();
    } catch {
      // Fullscreen API unsupported/denied — fall back to hiding chrome only
    }
    setImmersive(true);
  };

  return (
    <button onClick={toggle} className="focus-mode-immersive-btn">
      {immersive ? 'Exit Immersive Mode' : 'Enter Immersive Mode'}
    </button>
  );
}
