import { useRef } from 'react';

export default function DraggableTh({
  index,
  onMove,
  col,
  sortCol,
  sortDir,
  onSort,
  colKey,
  width,
  onWidthChange,
  onInitWidths,
  children,
}) {
  const thRef = useRef(null);
  const isSortable = col != null && onSort != null;
  const isActive = isSortable && col === sortCol;
  const key = colKey ?? col;

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setTimeout(() => e.target.classList.add('col-dragging'), 0);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('col-dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('col-drag-over');
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('col-drag-over');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('col-drag-over');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onMove(fromIndex, index);
    }
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onWidthChange || !key) return;

    // On first resize, snapshot all column widths so layout switches to fixed
    onInitWidths?.();

    const startX = e.clientX;
    const startWidth = thRef.current ? thRef.current.offsetWidth : 100;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveE) => {
      const newWidth = Math.max(20, startWidth + (moveE.clientX - startX));
      onWidthChange(key, newWidth);
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const isDraggable = !!onMove;
  const isResizable = !!onWidthChange;

  return (
    <th
      ref={thRef}
      className={`draggable-th${isSortable ? ' sortable' : ''}${isActive ? ' sorted' : ''}`}
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragEnd={isDraggable ? handleDragEnd : undefined}
      onDragOver={isDraggable ? handleDragOver : undefined}
      onDragLeave={isDraggable ? handleDragLeave : undefined}
      onDrop={isDraggable ? handleDrop : undefined}
      onClick={isSortable ? () => onSort(col) : undefined}
      style={{ width: width ? `${width}px` : undefined, position: 'relative' }}
    >
      {isDraggable && <span className="col-drag-handle" title="Drag to reorder">⠿</span>}
      {children}
      {isSortable && (
        <span className="sort-icon">
          {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}
        </span>
      )}
      {isResizable && (
        <div
          className="col-resize-handle"
          onMouseDown={handleResizeMouseDown}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </th>
  );
}
