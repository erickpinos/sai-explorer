export default function SortDropdown({ options, sortCol, sortDir, onSort }) {
  return (
    <div className="sort-dropdown">
      <label className="sort-dropdown-label">Sort by</label>
      <select
        className="sort-dropdown-select"
        value={sortCol || ''}
        onChange={(e) => onSort(e.target.value)}
      >
        {options.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <button
        className="sort-dropdown-dir"
        onClick={() => onSort(sortCol)}
        title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
      >
        {sortDir === 'desc' ? '▼' : '▲'}
      </button>
    </div>
  );
}
