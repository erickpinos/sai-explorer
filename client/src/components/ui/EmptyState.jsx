export default function EmptyState({ message = 'No data available' }) {
  return (
    <div className="empty">
      <p>{message}</p>
    </div>
  );
}
