import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import DraggableTh from '../ui/DraggableTh';
import Pagination from '../ui/Pagination';
import SortDropdown from '../ui/SortDropdown';
import { useViewToggle } from '../ui/ViewToggle';
import { useColumnOrder } from '../../hooks/useColumnOrder';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import { useSortedData } from '../../hooks/useSortedData';
import { usePagination } from '../../hooks/usePagination';
import { useLockView } from '../../hooks/useLockView';

export default function DataTable({
  tableKey,
  data,
  columns: defaultColumns,
  renderCell,
  renderMobileCard,
  sortGetters,
  defaultSortCol,
  defaultSortDir = 'desc',
  sortOptions,
  perPage,
  onRowClick,
  getRowKey,
  infoText,
  footer,
  hideLock = false,
}) {
  const PAGE_SIZE_OPTIONS = [50, 100, 500];
  const tableRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCol, setSearchCol] = useState('__all__');
  const [selectedPerPage, setSelectedPerPage] = useState(perPage ?? PAGE_SIZE_OPTIONS[0]);
  const { toggle, viewClass } = useViewToggle(tableKey);
  const { locked, toggleLock } = useLockView(tableKey);
  const { columns, moveColumn, resetColumns } = useColumnOrder(tableKey, defaultColumns);
  const { widths, setWidth, setAllWidths, resetWidths } = useColumnWidths(tableKey);

  // Filter data by search term, optionally scoped to a single column
  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q || !sortGetters) return data;
    if (searchCol !== '__all__' && sortGetters[searchCol]) {
      const getter = sortGetters[searchCol];
      return data.filter(row => {
        try {
          const val = getter(row);
          return val != null && String(val).toLowerCase().includes(q);
        } catch { return false; }
      });
    }
    return data.filter(row =>
      Object.values(sortGetters).some(getter => {
        try {
          const val = getter(row);
          return val != null && String(val).toLowerCase().includes(q);
        } catch { return false; }
      })
    );
  }, [data, searchTerm, searchCol, sortGetters]);

  const { sorted, sortCol, sortDir, handleSort: rawHandleSort } =
    useSortedData(filteredData, defaultSortCol ?? null, defaultSortDir, sortGetters ?? null);

  const { page, setPage, paginatedData, totalPages, startIndex } =
    usePagination(sorted, selectedPerPage);

  const handleSort = useCallback((col) => {
    rawHandleSort(col);
    setPage(1);
  }, [rawHandleSort, setPage]);

  // Snapshot all current column widths from the DOM before first resize,
  // so the table can switch to table-layout:fixed without a layout jump.
  const initWidths = useCallback(() => {
    if (Object.keys(widths).length > 0) return;
    const ths = tableRef.current?.querySelectorAll('thead th');
    if (!ths) return;
    const snapshot = {};
    columns.forEach((col, i) => {
      if (ths[i]) snapshot[col.key] = ths[i].offsetWidth;
    });
    setAllWidths(snapshot);
  }, [widths, columns, setAllWidths]);

  const anyWidthSet = Object.keys(widths).length > 0;

  const resolvedInfoText = typeof infoText === 'function'
    ? infoText(sorted.length, startIndex + 1, Math.min(startIndex + selectedPerPage, sorted.length))
    : infoText;

  const getKey = getRowKey ?? ((_, i) => i);

  return (
    <div className={viewClass}>
      {sortGetters && (
        <div className="table-search">
          <select
            className="table-search-select"
            value={searchCol}
            onChange={(e) => { setSearchCol(e.target.value); setPage(1); }}
          >
            <option value="__all__">All columns</option>
            {columns.filter(c => sortGetters[c.key]).map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={searchCol === '__all__' ? 'Search across all columns...' : `Search by ${columns.find(c => c.key === searchCol)?.label ?? searchCol}...`}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="table-search-input"
          />
          {searchTerm && (
            <button className="table-search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      )}
      <div className="table-info">
        {resolvedInfoText}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select
            className="table-search-select"
            value={selectedPerPage}
            onChange={(e) => { setSelectedPerPage(Number(e.target.value)); setPage(1); }}
            style={{ minWidth: 'auto' }}
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n} rows</option>
            ))}
          </select>
          {!hideLock && !locked && (
            <button
              className="reset-cols-btn"
              onClick={() => { resetColumns(); resetWidths(); }}
              title="Reset column order and widths"
            >
              ↺ Columns
            </button>
          )}
          {!hideLock && (
            <button
              className={`reset-cols-btn${locked ? ' lock-view-btn--locked' : ''}`}
              onClick={toggleLock}
              title={locked ? 'Unlock view' : 'Lock view'}
            >
              {locked ? '⊠ Locked' : '⊠ Unlocked'}
            </button>
          )}
          {toggle}
        </div>
      </div>

      <div className="table-wrapper profile-table-desktop">
        <table
          ref={tableRef}
          style={anyWidthSet ? { tableLayout: 'fixed' } : undefined}
        >
          <thead>
            <tr>
              {columns.map((col, i) => (
                <DraggableTh
                  key={col.key}
                  index={i}
                  onMove={locked ? undefined : moveColumn}
                  col={col.sortable ? col.key : undefined}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={col.sortable ? handleSort : undefined}
                  colKey={col.key}
                  width={widths[col.key]}
                  onWidthChange={locked ? undefined : setWidth}
                  onInitWidths={locked ? undefined : initWidths}
                >
                  {col.label}
                </DraggableTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, i) => (
              <tr
                key={getKey(row, i)}
                className={onRowClick ? 'clickable-row' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <Fragment key={col.key}>
                    {renderCell(col.key, row, startIndex + i)}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortOptions?.length > 0 && (
        <SortDropdown options={sortOptions} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
      )}

      <div className="profile-cards-mobile">
        {paginatedData.map((row, i) => renderMobileCard(row, startIndex + i))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {footer}
    </div>
  );
}
