import { Fragment, useCallback, useRef } from 'react';
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
}) {
  const tableRef = useRef(null);
  const { toggle, viewClass } = useViewToggle();
  const { locked, toggleLock } = useLockView(tableKey);
  const { columns, moveColumn, resetColumns } = useColumnOrder(tableKey, defaultColumns);
  const { widths, setWidth, setAllWidths, resetWidths } = useColumnWidths(tableKey);

  const { sorted, sortCol, sortDir, handleSort: rawHandleSort } =
    useSortedData(data, defaultSortCol ?? null, defaultSortDir, sortGetters ?? null);

  const effectivePerPage = perPage ?? Math.max(1, sorted.length);
  const { page, setPage, paginatedData, totalPages, startIndex } =
    usePagination(sorted, effectivePerPage);

  const handleSort = useCallback((col) => {
    rawHandleSort(col);
    if (perPage != null) setPage(1);
  }, [rawHandleSort, setPage, perPage]);

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
    ? infoText(sorted.length, startIndex + 1, Math.min(startIndex + effectivePerPage, sorted.length))
    : infoText;

  const getKey = getRowKey ?? ((_, i) => i);

  return (
    <div className={viewClass}>
      <div className="table-info">
        {resolvedInfoText}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!locked && (
            <button
              className="reset-cols-btn"
              onClick={() => { resetColumns(); resetWidths(); }}
              title="Reset column order and widths"
            >
              ↺ Columns
            </button>
          )}
          <button
            className={`reset-cols-btn${locked ? ' lock-view-btn--locked' : ''}`}
            onClick={toggleLock}
            title={locked ? 'Unlock view' : 'Lock view'}
          >
            {locked ? '⊠ Locked' : '⊠ Unlocked'}
          </button>
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
