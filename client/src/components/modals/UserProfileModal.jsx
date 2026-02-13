import { useState } from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import { useUserStats, useUserTrades, useUserDeposits, useUserWithdraws } from '../../hooks/useApi';
import { formatNumber, formatDate } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

// Import helper functions from TradesTable
const getBadgeClass = (status) => {
  if (!status) return 'badge badge-purple';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('liquidat')) return 'badge badge-red';
  if (statusLower.includes('opened')) return 'badge badge-blue';
  if (statusLower.includes('closed')) return 'badge badge-purple';
  return 'badge badge-purple';
};

const formatTradeTypeBadge = (type) => {
  if (!type) return 'Unknown';
  const statusLower = type.toLowerCase();
  if (statusLower.includes('liquidat')) return 'Liquidated';
  if (statusLower.includes('opened')) return 'Opened';
  if (statusLower.includes('closed')) return 'Closed';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatPnl = (pnl) => {
  if (!pnl || pnl === 0) return '-';
  const sign = pnl > 0 ? '+' : '';
  return `${sign}$${formatNumber(Math.abs(pnl), 2)}`;
};

export default function UserProfileModal({ address, onClose }) {
  const { network } = useNetwork();
  const [activeTab, setActiveTab] = useState('trades');

  const { data: stats, loading: statsLoading } = useUserStats(address, network);
  const { data: trades, loading: tradesLoading } = useUserTrades(address, network);
  const { data: deposits, loading: depositsLoading } = useUserDeposits(address, network);
  const { data: withdraws, loading: withdrawsLoading } = useUserWithdraws(address, network);

  if (!address) return null;

  const renderStats = () => (
    <div className="modal-stats">
      <div className="stat-card">
        <div className="stat-value">
          {statsLoading ? '...' : formatNumber(stats?.tradeCount || 0, 0)}
        </div>
        <div className="stat-label">Trades</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">
          {statsLoading ? '...' : `$${formatNumber(stats?.totalVolume || 0, 2)}`}
        </div>
        <div className="stat-label">Total Volume</div>
      </div>

      <div className="stat-card">
        <div className={`stat-value ${(stats?.realizedPnl || 0) > 0 ? 'pnl-positive' : 'pnl-negative'}`}>
          {statsLoading ? '...' : formatPnl(stats?.realizedPnl || 0)}
        </div>
        <div className="stat-label">Realized PnL</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">
          {statsLoading ? '...' : formatNumber(stats?.lpDepositsCount || 0, 0)}
        </div>
        <div className="stat-label">LP Deposits</div>
      </div>
    </div>
  );

  const renderTrades = () => {
    if (tradesLoading) return <LoadingSpinner />;
    if (!trades || trades.length === 0) return <EmptyState message="No trades found" />;

    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>TIME</th>
              <th>TYPE</th>
              <th>MARKET</th>
              <th>DIRECTION</th>
              <th>LEVERAGE</th>
              <th>OPEN PRICE</th>
              <th>CLOSE PRICE</th>
              <th>COLLATERAL</th>
              <th>PNL</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 50).map((trade) => (
              <tr key={trade.id}>
                <td>{formatDate(trade.block?.block_ts)}</td>
                <td>
                  <span className={getBadgeClass(trade.tradeChangeType)}>
                    {formatTradeTypeBadge(trade.tradeChangeType)}
                  </span>
                </td>
                <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>
                <td>
                  <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
                    {trade.trade?.isLong ? 'Long' : 'Short'}
                  </span>
                </td>
                <td>{formatNumber(trade.trade?.leverage, 1)}x</td>
                <td>${formatNumber(trade.trade?.openPrice || 0, 2)}</td>
                <td>
                  {trade.trade?.closePrice ? `$${formatNumber(trade.trade.closePrice, 2)}` : '-'}
                </td>
                <td>${formatNumber((trade.trade?.collateralAmount || 0) / 1000000, 2)}</td>
                <td className={trade.realizedPnlCollateral > 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatPnl(trade.realizedPnlCollateral / 1000000)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDeposits = () => {
    if (depositsLoading) return <LoadingSpinner />;
    if (!deposits || deposits.length === 0) return <EmptyState message="No deposits found" />;

    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Vault</th>
              <th>Amount</th>
              <th>Shares</th>
            </tr>
          </thead>
          <tbody>
            {deposits.slice(0, 50).map((deposit, idx) => (
              <tr key={idx}>
                <td>{formatDate(deposit.block_ts)}</td>
                <td>{deposit.collateral_token_symbol || '-'}</td>
                <td>${formatNumber(deposit.amount / 1000000, 2)}</td>
                <td>{formatNumber(deposit.shares / 1000000, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderWithdrawals = () => {
    if (withdrawsLoading) return <LoadingSpinner />;
    if (!withdraws || withdraws.length === 0) return <EmptyState message="No withdrawals found" />;

    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Unlock Epoch</th>
              <th>Vault</th>
              <th>Shares</th>
              <th>Auto Redeem</th>
            </tr>
          </thead>
          <tbody>
            {withdraws.slice(0, 50).map((withdraw, idx) => (
              <tr key={idx}>
                <td>{withdraw.unlock_epoch}</td>
                <td>{withdraw.collateral_token_symbol || '-'}</td>
                <td>{formatNumber(withdraw.shares / 1000000, 2)}</td>
                <td>{withdraw.auto_redeem ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'trades':
        return renderTrades();
      case 'deposits':
        return renderDeposits();
      case 'withdrawals':
        return renderWithdrawals();
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>User Profile</h2>
            <span className="address">{address}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {renderStats()}

        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'trades' ? 'active' : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            Trades
          </button>
          <button
            className={`tab ${activeTab === 'deposits' ? 'active' : ''}`}
            onClick={() => setActiveTab('deposits')}
          >
            LP Deposits
          </button>
          <button
            className={`tab ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            Withdrawals
          </button>
        </div>

        <div className="modal-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
