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

  if (!address) return null;

  // Extract addresses - address can be either a string or an object with bech32 and evm
  const bech32Address = typeof address === 'string' ? address : address.bech32;
  const evmAddress = typeof address === 'string' ? address : address.evm;
  const apiAddress = evmAddress || bech32Address; // Use EVM address for API calls

  const { data: stats, loading: statsLoading } = useUserStats(apiAddress, network);
  const { data: trades, loading: tradesLoading } = useUserTrades(apiAddress, network);
  const { data: deposits, loading: depositsLoading } = useUserDeposits(apiAddress, network);
  const { data: withdraws, loading: withdrawsLoading } = useUserWithdraws(apiAddress, network);

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

    const tradeList = trades.slice(0, 50);

    return (
      <>
        {/* Desktop table */}
        <div className="table-wrapper profile-table-desktop">
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
              {tradeList.map((trade) => (
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

        {/* Mobile cards */}
        <div className="profile-cards-mobile">
          {tradeList.map((trade) => {
            const pnl = trade.realizedPnlCollateral / 1000000;
            return (
              <div key={trade.id} className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-badges">
                    <span className={getBadgeClass(trade.tradeChangeType)}>
                      {formatTradeTypeBadge(trade.tradeChangeType)}
                    </span>
                    <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
                      {trade.trade?.isLong ? 'Long' : 'Short'}
                    </span>
                    <span className="profile-card-market">
                      {trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}
                    </span>
                  </div>
                  <span className="profile-card-time">{formatDate(trade.block?.block_ts)}</span>
                </div>
                <div className="profile-card-row">
                  <span className="profile-card-label">Leverage</span>
                  <span className="profile-card-value">{formatNumber(trade.trade?.leverage, 1)}x</span>
                  <span className="profile-card-label">Collateral</span>
                  <span className="profile-card-value">${formatNumber((trade.trade?.collateralAmount || 0) / 1000000, 2)}</span>
                </div>
                <div className="profile-card-row">
                  <span className="profile-card-label">Open</span>
                  <span className="profile-card-value">${formatNumber(trade.trade?.openPrice || 0, 2)}</span>
                  <span className="profile-card-label">Close</span>
                  <span className="profile-card-value">
                    {trade.trade?.closePrice ? `$${formatNumber(trade.trade.closePrice, 2)}` : '-'}
                  </span>
                </div>
                {pnl !== 0 && (
                  <div className="profile-card-row">
                    <span className="profile-card-label">PnL</span>
                    <span className={pnl > 0 ? 'pnl-positive profile-card-value' : 'pnl-negative profile-card-value'}>{formatPnl(pnl)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderDeposits = () => {
    if (depositsLoading) return <LoadingSpinner />;
    if (!deposits || deposits.length === 0) return <EmptyState message="No deposits found" />;

    const depositList = deposits.slice(0, 50);

    return (
      <>
        {/* Desktop table */}
        <div className="table-wrapper profile-table-desktop">
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
              {depositList.map((deposit, idx) => (
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

        {/* Mobile cards */}
        <div className="profile-cards-mobile">
          {depositList.map((deposit, idx) => (
            <div key={idx} className="profile-card">
              <div className="profile-card-header">
                <span className="profile-card-market">{deposit.collateral_token_symbol || '-'} Vault</span>
                <span className="profile-card-time">{formatDate(deposit.block_ts)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Amount</span>
                <span className="profile-card-value">${formatNumber(deposit.amount / 1000000, 2)}</span>
                <span className="profile-card-label">Shares</span>
                <span className="profile-card-value">{formatNumber(deposit.shares / 1000000, 2)}</span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderWithdrawals = () => {
    if (withdrawsLoading) return <LoadingSpinner />;
    if (!withdraws || withdraws.length === 0) return <EmptyState message="No withdrawals found" />;

    const withdrawList = withdraws.slice(0, 50);

    return (
      <>
        {/* Desktop table */}
        <div className="table-wrapper profile-table-desktop">
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
              {withdrawList.map((withdraw, idx) => (
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

        {/* Mobile cards */}
        <div className="profile-cards-mobile">
          {withdrawList.map((withdraw, idx) => (
            <div key={idx} className="profile-card">
              <div className="profile-card-header">
                <span className="profile-card-market">{withdraw.collateral_token_symbol || '-'} Vault</span>
                <span className="profile-card-time">Epoch {withdraw.unlock_epoch}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Shares</span>
                <span className="profile-card-value">{formatNumber(withdraw.shares / 1000000, 2)}</span>
                <span className="profile-card-label">Auto Redeem</span>
                <span className="profile-card-value">{withdraw.auto_redeem ? 'Yes' : 'No'}</span>
              </div>
            </div>
          ))}
        </div>
      </>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {bech32Address && (
                <a
                  href={`https://nibiru.explorers.guru/account/${bech32Address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="address"
                  style={{ color: '#6366f1', textDecoration: 'none' }}
                >
                  {bech32Address}
                </a>
              )}
              {evmAddress && (
                <a
                  href={`https://nibiscan.io/address/${evmAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="address"
                  style={{ color: '#6366f1', textDecoration: 'none' }}
                >
                  {evmAddress}
                </a>
              )}
            </div>
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
