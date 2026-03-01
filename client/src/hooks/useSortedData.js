import { useState, useMemo } from 'react';

export function useSortedData(data, defaultCol, defaultDir = 'desc', sortGetters = null) {
  const [sortCol, setSortCol] = useState(defaultCol);
  const [sortDir, setSortDir] = useState(defaultDir);

  const handleSort = (col) => {
    if (col === sortCol) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir(defaultDir);
    }
  };

  const sorted = useMemo(() => {
    if (!data || !data.length) return data || [];
    if (!sortCol) return data;
    const getter = sortGetters ? sortGetters[sortCol] : (item) => item[sortCol];
    if (!getter) return data;
    return [...data].sort((a, b) => {
      const aVal = getter(a) ?? 0;
      const bVal = getter(b) ?? 0;
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortCol, sortDir, sortGetters]);

  return { sorted, sortCol, sortDir, handleSort };
}
