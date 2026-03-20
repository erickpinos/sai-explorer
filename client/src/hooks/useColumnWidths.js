import { useState, useCallback } from 'react';

export function useColumnWidths(tableKey) {
  const storageKey = `sai-col-widths-${tableKey}`;

  const [widths, setWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {};
  });

  const setWidth = useCallback((colKey, width) => {
    setWidths(prev => {
      const next = { ...prev, [colKey]: width };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  const resetWidths = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
    setWidths({});
  }, [storageKey]);

  const setAllWidths = useCallback((map) => {
    setWidths(prev => {
      const next = { ...prev, ...map };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  return { widths, setWidth, setAllWidths, resetWidths };
}
