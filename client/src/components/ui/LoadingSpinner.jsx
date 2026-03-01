import { memo } from 'react';

export default memo(function LoadingSpinner() {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>Loading data...</p>
    </div>
  );
});
