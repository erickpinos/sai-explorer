import { useState, useCallback } from 'react';

export function useLockView(tableKey) {
  const storageKey = `sai-view-locked-${tableKey}`;

  const [locked, setLocked] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return true; // default: locked
  });

  const toggleLock = useCallback(() => {
    setLocked(prev => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(storageKey, 'true');
        else localStorage.removeItem(storageKey);
      } catch (e) {}
      return next;
    });
  }, [storageKey]);

  return { locked, toggleLock };
}
