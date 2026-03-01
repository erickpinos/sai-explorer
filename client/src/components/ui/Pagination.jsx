export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
        Previous
      </button>
      <span>Page {page} of {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
        Next
      </button>
    </div>
  );
}
