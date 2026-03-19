import { useNavigate } from 'react-router-dom';
import { useStats } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatUSD } from '../../utils/formatters';

export default function Stats() {
  const { network } = useNetwork();
  const { data: stats, loading } = useStats(network);
  const navigate = useNavigate();

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
        <div className="stat-card clickable" onClick={() => navigate('/trades')} title="View Perpetual Trades">
          <div className="stat-label">Perpetual Trades</div>
          <div className="stat-value">{formatNumber(stats?.trades?.total || 0, 0)}</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/insights')} title="View Insights">
          <div className="stat-label">Total Volume</div>
          <div className="stat-value">{formatUSD(stats?.trades?.volume || 0)}</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/vaults')} title="View LP Vaults">
          <div className="stat-label">Total TVL</div>
          <div className="stat-value">{formatUSD(stats?.tvl || 0)}</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/deposits')} title="View LP Deposits">
          <div className="stat-label">LP Deposits</div>
          <div className="stat-value">{formatNumber(stats?.deposits?.total || 0, 0)}</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/withdraws')} title="View Withdraw Requests">
          <div className="stat-label">Withdraw Requests</div>
          <div className="stat-value">{formatNumber(stats?.withdraws?.total || 0, 0)}</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/volume')} title="View User Stats">
          <div className="stat-label">Unique Traders</div>
          <div className="stat-value">{formatNumber(stats?.traders?.unique || 0, 0)}</div>
        </div>
      </div>

</>
  );
}
