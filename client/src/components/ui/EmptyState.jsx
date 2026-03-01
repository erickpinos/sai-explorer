import { memo } from 'react';

export default memo(function EmptyState({ message = 'No data available' }) {
  return (
    <div className="empty">
      <p>{message}</p>
    </div>
  );
});
