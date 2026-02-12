import { useStats } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatUSD } from '../../utils/formatters';

export default function Stats() {
  const { network } = useNetwork();
  const { data: stats, loading } = useStats(network);

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
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Total Trades</div>
        <div className="stat-value">{formatNumber(stats?.trades?.total || 0, 0)}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Trading Volume</div>
        <div className="stat-value">{formatUSD(stats?.trades?.volume || 0)}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Total Deposits</div>
        <div className="stat-value">{formatNumber(stats?.deposits?.total || 0, 0)}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Unique Traders</div>
        <div className="stat-value">{formatNumber(stats?.traders?.unique || 0, 0)}</div>
      </div>
    </div>
  );
}
