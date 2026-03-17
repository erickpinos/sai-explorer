import { useState, useCallback } from 'react';

export function useColumnOrder(tableKey, defaultColumns) {
  const storageKey = `sai-col-order-${tableKey}`;

  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedKeys = JSON.parse(saved);
        const orderedCols = savedKeys
          .map(key => defaultColumns.find(c => c.key === key))
          .filter(Boolean);
        // Append any new columns not present in saved order
        const newCols = defaultColumns.filter(c => !savedKeys.includes(c.key));
        return [...orderedCols, ...newCols];
      }
    } catch (e) {}
    return defaultColumns;
  });

  const moveColumn = useCallback((fromIndex, toIndex) => {
    setColumns(prev => {
      const next = [...prev];
      const [col] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, col);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next.map(c => c.key)));
      } catch (e) {}
      return next;
    });
  }, [storageKey]);

  const resetColumns = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
    setColumns(defaultColumns);
  }, [storageKey, defaultColumns]);

  return { columns, moveColumn, resetColumns };
}
