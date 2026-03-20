import { ChevronDown, ChevronUp } from 'lucide-react';

export default function SortTh({ col, sortCol, sortDir, onSort, children }) {
  const active = col === sortCol;
  return (
    <th
      className={`sortable${active ? ' sorted' : ''}`}
      onClick={() => onSort(col)}
    >
      {children} <span className="sort-icon">{active ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : <ChevronDown size={12} />}</span>
    </th>
  );
}
