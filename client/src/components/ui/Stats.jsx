import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStats } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatUSD } from '../../utils/formatters';

export default function Stats() {
  const { network } = useNetwork();
  const { data: stats, loading } = useStats(network);
  const navigate = useNavigate();
  const mouseDownPos = useRef(null);

  const handleMouseDown = useCallback((e) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleClick = useCallback((path, e) => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    if (mouseDownPos.current) {
      const dx = Math.abs(e.clientX - mouseDownPos.current.x);
      const dy = Math.abs(e.clientY - mouseDownPos.current.y);
      if (dx > 5 || dy > 5) return;
    }
    navigate(path);
  }, [navigate]);

  if (loading) {
    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card clickable" onMouseDown={handleMouseDown} onClick={(e) => handleClick('/insights', e)} title="View Insights">
          <div className="stat-label">Total Volume</div>
          <div className="stat-value">{formatUSD(stats?.trades?.volume || 0)}</div>
        </div>
        <div className="stat-card clickable" onMouseDown={handleMouseDown} onClick={(e) => handleClick('/trades', e)} title="View Perpetual Trades">
          <div className="stat-label">Perpetual Trades</div>
          <div className="stat-value">{formatNumber(stats?.trades?.total || 0, 0)}</div>
        </div>
        <div className="stat-card clickable" onMouseDown={handleMouseDown} onClick={(e) => handleClick('/vaults', e)} title="View LP Vaults">
          <div className="stat-label">Total TVL</div>
          <div className="stat-value">{formatUSD(stats?.tvl || 0)}</div>
        </div>
        <div className="stat-card clickable" onMouseDown={handleMouseDown} onClick={(e) => handleClick('/deposits', e)} title="View LP Deposits">
          <div className="stat-label">LP Deposits</div>
          <div className="stat-value">{formatNumber(stats?.deposits?.total || 0, 0)}</div>
        </div>
        <div className="stat-card clickable" onMouseDown={handleMouseDown} onClick={(e) => handleClick('/withdraws', e)} title="View Withdraw Requests">
          <div className="stat-label">Withdraw Requests</div>
          <div className="stat-value">{formatNumber(stats?.withdraws?.total || 0, 0)}</div>
        </div>
        <div className="stat-card clickable" onMouseDown={handleMouseDown} onClick={(e) => handleClick('/volume', e)} title="View User Stats">
          <div className="stat-label">Unique Traders</div>
          <div className="stat-value">{formatNumber(stats?.traders?.unique || 0, 0)}</div>
        </div>
      </div>

</>
  );
}
