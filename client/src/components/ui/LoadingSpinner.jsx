import { memo } from 'react';

export default memo(function LoadingSpinner() {
  return (
    <div className="loading" role="status" aria-label="Loading data">
      <div className="spinner"></div>
      <p>Loading data...</p>
    </div>
  );
});
