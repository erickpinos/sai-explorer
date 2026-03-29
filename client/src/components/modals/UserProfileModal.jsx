import { useState } from 'react';
import { X } from 'lucide-react';
import { useNetwork } from '../../hooks/useNetwork';
import { useUserStats, useUserTrades, useUserDeposits, useUserWithdraws } from '../../hooks/useApi';
import { formatNumber, formatDate, formatPrice } from '../../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, shortenHash, toUsd } from '../../utils/tradeHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import SortTh from '../ui/SortTh';
import { useSortedData } from '../../hooks/useSortedData';
import { usePagination } from '../../hooks/usePagination';

const TRADE_SORT_GETTERS = {
  time:       (t) => new Date(t.block?.block_ts || 0).getTime(),
  type:       (t) => t.tradeChangeType || '',
  market:     (t) => t.trade?.perpBorrowing?.baseToken?.symbol || '',
  direction:  (t) => t.trade?.isLong ? 1 : 0,
  leverage:   (t) => parseFloat(t.trade?.leverage) || 0,
  openPrice:  (t) => parseFloat(t.trade?.openPrice) || 0,
  closePrice: (t) => parseFloat(t.trade?.closePrice) || 0,
  collateral: (t) => toUsd(t.trade?.collateralAmount, t.collateralPrice),
  pnl:        (t) => toUsd(t.realizedPnlCollateral, t.collateralPrice),
};

const DEPOSIT_SORT_GETTERS = {
  time:   (d) => new Date(d.block_ts || 0).getTime(),
  vault:  (d) => d.collateral_token_symbol || '',
  amount: (d) => parseFloat(d.amount) || 0,
  shares: (d) => parseFloat(d.shares) || 0,
};

const WITHDRAW_SORT_GETTERS = {
  epoch:  (w) => parseFloat(w.unlock_epoch) || 0,
  vault:  (w) => w.collateral_token_symbol || '',
  shares: (w) => parseFloat(w.shares) || 0,
};

export default function UserProfileModal({ address, onClose }) {
  const { network, config } = useNetwork();
  const [activeTab, setActiveTab] = useState('trades');

  // Extract addresses - address can be either a string or an object with bech32 and evm
  const bech32Address = typeof address === 'string' ? address : address?.bech32;
  const evmAddress = typeof address === 'string' ? address : address?.evm;
  const apiAddress = evmAddress || bech32Address; // Use EVM address for API calls

  const { data: stats, loading: statsLoading } = useUserStats(apiAddress, network);
  const { data: trades, loading: tradesLoading } = useUserTrades(apiAddress, network);
  const { data: deposits, loading: depositsLoading } = useUserDeposits(apiAddress, network);
  const { data: withdraws, loading: withdrawsLoading } = useUserWithdraws(apiAddress, network);

  const { sorted: sortedTrades, sortCol: tradeSortCol, sortDir: tradeSortDir, handleSort: handleTradeSort } =
    useSortedData(trades, 'time', 'desc', TRADE_SORT_GETTERS);
  const { sorted: sortedDeposits, sortCol: depositSortCol, sortDir: depositSortDir, handleSort: handleDepositSort } =
    useSortedData(deposits, 'time', 'desc', DEPOSIT_SORT_GETTERS);
  const { sorted: sortedWithdraws, sortCol: withdrawSortCol, sortDir: withdrawSortDir, handleSort: handleWithdrawSort } =
    useSortedData(withdraws, 'epoch', 'desc', WITHDRAW_SORT_GETTERS);

  const MODAL_PER_PAGE = 50;
  const { page: tradePage, setPage: setTradePage, paginatedData: tradeList, totalPages: tradeTotalPages, startIndex: tradeStartIndex } =
    usePagination(sortedTrades, MODAL_PER_PAGE);
  const { page: depositPage, setPage: setDepositPage, paginatedData: depositList, totalPages: depositTotalPages, startIndex: depositStartIndex } =
    usePagination(sortedDeposits, MODAL_PER_PAGE);
  const { page: withdrawPage, setPage: setWithdrawPage, paginatedData: withdrawList, totalPages: withdrawTotalPages, startIndex: withdrawStartIndex } =
    usePagination(sortedWithdraws, MODAL_PER_PAGE);

  if (!address) return null;

  const renderPagination = (total, startIndex, pageLength, page, totalPages, setPage) => (
    <div className="pagination" style={{ marginTop: '12px' }}>
      <span className="pagination-info">
        Showing {startIndex + 1}-{startIndex + pageLength} of {total}
      </span>
      <div className="pagination-controls">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>&laquo; Prev</button>
        <span className="pagination-page">Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next &raquo;</button>
      </div>
    </div>
  );

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
      <>
        {/* Desktop table */}
        <div className="table-wrapper profile-table-desktop">
          <table>
            <thead>
              <tr>
                <SortTh col="time" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>TIME</SortTh>
                <SortTh col="type" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>TYPE</SortTh>
                <SortTh col="market" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>MARKET</SortTh>
                <SortTh col="direction" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>DIRECTION</SortTh>
                <SortTh col="leverage" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>LEVERAGE</SortTh>
                <SortTh col="openPrice" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>OPEN PRICE</SortTh>
                <SortTh col="closePrice" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>CLOSE PRICE</SortTh>
                <SortTh col="collateral" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>COLLATERAL</SortTh>
                <SortTh col="pnl" sortCol={tradeSortCol} sortDir={tradeSortDir} onSort={handleTradeSort}>PNL</SortTh>
                <th>TX Hash</th>
                <th>EVM TX Hash</th>
              </tr>
            </thead>
            <tbody>
              {tradeList.map((trade) => {
              const displayType = (
                trade.trade?.tradeType === 'limit' &&
                trade.tradeChangeType?.toLowerCase().includes('closed') &&
                !parseFloat(trade.trade?.closePrice) &&
                !parseFloat(trade.realizedPnlCollateral)
              ) ? 'limit_order_cancelled' : trade.tradeChangeType;
              return (
                <tr key={trade.id}>
                  <td>{formatDate(trade.block?.block_ts)}</td>
                  <td>
                    <span className={getBadgeClass(displayType, trade.txFailed)}>
                      {formatTradeTypeBadge(displayType, trade.txFailed)}
                    </span>
                  </td>
                  <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>
                  <td>
                    <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
                      {trade.trade?.isLong ? 'Long' : 'Short'}
                    </span>
                  </td>
                  <td>{formatNumber(trade.trade?.leverage, 1)}x</td>
                  <td>{formatPrice(trade.trade?.openPrice || 0)}</td>
                  <td>
                    {parseFloat(trade.trade?.closePrice) > 0 ? formatPrice(trade.trade.closePrice) : '-'}
                  </td>
                  <td>${formatNumber(toUsd(trade.trade?.collateralAmount, trade.collateralPrice, trade.trade?.openCollateralAmount), 2)}</td>
                  <td className={trade.realizedPnlCollateral > 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {formatPnl(toUsd(trade.realizedPnlCollateral, trade.collateralPrice))}
                  </td>
                <td>
                  {trade.txHash ? (
                    <a href={`${config.explorerTx}${trade.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {shortenHash(trade.txHash)}
                    </a>
                  ) : '-'}
                </td>
                <td>
                  {trade.evmTxHash ? (
                    <a href={`${config.explorerEvmTx}${trade.evmTxHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {shortenHash(trade.evmTxHash)}
                    </a>
                  ) : '-'}
                </td>
                </tr>
                );
            })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="profile-cards-mobile">
          {tradeList.map((trade) => {
            const pnl = toUsd(trade.realizedPnlCollateral, trade.collateralPrice);
            return (
              <div key={trade.id} className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-badges">
                    <span className={getBadgeClass(trade.tradeChangeType, trade.txFailed)}>
                      {formatTradeTypeBadge(trade.tradeChangeType, trade.txFailed)}
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
                  <span className="profile-card-value">${formatNumber(toUsd(trade.trade?.collateralAmount, trade.collateralPrice, trade.trade?.openCollateralAmount), 2)}</span>
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

        {tradeTotalPages > 1 && renderPagination(trades.length, tradeStartIndex, tradeList.length, tradePage, tradeTotalPages, setTradePage)}
      </>
    );
  };

  const renderDeposits = () => {
    if (depositsLoading) return <LoadingSpinner />;
    if (!deposits || deposits.length === 0) return <EmptyState message="No deposits found" />;

    return (
      <>
        {/* Desktop table */}
        <div className="table-wrapper profile-table-desktop">
          <table>
            <thead>
              <tr>
                <SortTh col="time" sortCol={depositSortCol} sortDir={depositSortDir} onSort={handleDepositSort}>Time</SortTh>
                <SortTh col="vault" sortCol={depositSortCol} sortDir={depositSortDir} onSort={handleDepositSort}>Vault</SortTh>
                <SortTh col="amount" sortCol={depositSortCol} sortDir={depositSortDir} onSort={handleDepositSort}>Amount</SortTh>
                <SortTh col="shares" sortCol={depositSortCol} sortDir={depositSortDir} onSort={handleDepositSort}>Shares</SortTh>
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

        {depositTotalPages > 1 && renderPagination(deposits.length, depositStartIndex, depositList.length, depositPage, depositTotalPages, setDepositPage)}
      </>
    );
  };

  const renderWithdrawals = () => {
    if (withdrawsLoading) return <LoadingSpinner />;
    if (!withdraws || withdraws.length === 0) return <EmptyState message="No withdrawals found" />;

    return (
      <>
        {/* Desktop table */}
        <div className="table-wrapper profile-table-desktop">
          <table>
            <thead>
              <tr>
                <SortTh col="epoch" sortCol={withdrawSortCol} sortDir={withdrawSortDir} onSort={handleWithdrawSort}>Unlock Epoch</SortTh>
                <SortTh col="vault" sortCol={withdrawSortCol} sortDir={withdrawSortDir} onSort={handleWithdrawSort}>Vault</SortTh>
                <SortTh col="shares" sortCol={withdrawSortCol} sortDir={withdrawSortDir} onSort={handleWithdrawSort}>Shares</SortTh>
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

        {withdrawTotalPages > 1 && renderPagination(withdraws.length, withdrawStartIndex, withdrawList.length, withdrawPage, withdrawTotalPages, setWithdrawPage)}
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
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
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
