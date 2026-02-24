import { useState, useMemo } from 'react';
import { useTrades } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import UserProfileModal from '../modals/UserProfileModal';
import { TRADES_PER_PAGE } from '../../utils/constants';

const getBadgeClass = (status) => {
  if (!status) return 'badge badge-purple';
  const s = status.toLowerCase();
  if (s.includes('liquidat')) return 'badge badge-red';
  if (s.includes('opened')) return 'badge badge-blue';
  if (s.includes('closed')) return 'badge badge-purple';
  if (s.includes('trigger')) return 'badge badge-yellow';
  return 'badge badge-purple';
};

const formatTradeTypeBadge = (type) => {
  if (!type) return 'Unknown';
  const s = type.toLowerCase();
  if (s.includes('liquidat')) return 'Liquidated';
  if (s.includes('opened')) return 'Opened';
  if (s.includes('closed')) return 'Closed';
  if (s.includes('trigger')) return 'Triggered';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatPnl = (pnl) => {
  if (!pnl || pnl === 0) return '-';
  const sign = pnl > 0 ? '+' : '';
  return `${sign}$${formatNumber(Math.abs(pnl), 2)}`;
};

const shortenHash = (hash) => {
  if (!hash) return '-';
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
};

const SORT_GETTERS = {
  time:       (t) => new Date(t.block?.block_ts || 0).getTime(),
  type:       (t) => t.tradeChangeType || '',
  market:     (t) => t.trade?.perpBorrowing?.baseToken?.symbol || '',
  trader:     (t) => t.trade?.trader || '',
  evmAddress: (t) => t.trade?.evmTrader || '',
  direction:  (t) => t.trade?.isLong ? 1 : 0,
  leverage:   (t) => parseFloat(t.trade?.leverage) || 0,
  openPrice:  (t) => parseFloat(t.trade?.openPrice) || 0,
  closePrice: (t) => parseFloat(t.trade?.closePrice) || 0,
  collateral: (t) => parseFloat(t.trade?.collateralAmount) || 0,
  pnl:        (t) => parseFloat(t.realizedPnlCollateral) || 0,
};

export default function TradesTable() {
  const { network, config } = useNetwork();
  const { data: trades, loading, error } = useTrades(network);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);
  const [sortCol, setSortCol] = useState('time');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (col === sortCol) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  const sorted = useMemo(() => {
    if (!trades) return [];
    const getter = SORT_GETTERS[sortCol];
    if (!getter) return trades;
    return [...trades].sort((a, b) => {
      const aVal = getter(a);
      const bVal = getter(b);
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [trades, sortCol, sortDir]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No trades found" />;

  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const endIndex = startIndex + TRADES_PER_PAGE;
  const paginatedTrades = sorted.slice(startIndex, endIndex);
  const totalPages = Math.ceil(sorted.length / TRADES_PER_PAGE);

  const SortTh = ({ col, children }) => {
    const active = col === sortCol;
    return (
      <th
        className={`sortable${active ? ' sorted' : ''}`}
        onClick={() => handleSort(col)}
      >
        {children} <span className="sort-icon">{active ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}</span>
      </th>
    );
  };

  return (
    <div>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, sorted.length)} of {sorted.length} transactions
      </div>

      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <SortTh col="time">Time</SortTh>
              <SortTh col="type">Type</SortTh>
              <SortTh col="market">Market</SortTh>
              <SortTh col="trader">Trader</SortTh>
              <SortTh col="evmAddress">EVM Address</SortTh>
              <SortTh col="direction">Direction</SortTh>
              <SortTh col="leverage">Leverage</SortTh>
              <SortTh col="openPrice">Open Price</SortTh>
              <SortTh col="closePrice">Close Price</SortTh>
              <SortTh col="collateral">Collateral</SortTh>
              <SortTh col="pnl">PNL</SortTh>
              <th>TX Hash</th>
              <th>EVM TX Hash</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTrades.map((trade) => (
              <tr key={trade.id}>
                <td>{formatDate(trade.block?.block_ts)}</td>
                <td>
                  <span className={getBadgeClass(trade.tradeChangeType)}>
                    {formatTradeTypeBadge(trade.tradeChangeType)}
                  </span>
                </td>
                <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>
                <td>
                  <span
                    className="address-link"
                    title={trade.trade?.trader}
                    onClick={() => setSelectedUserAddress({ bech32: trade.trade?.trader, evm: trade.trade?.evmTrader })}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(trade.trade?.trader)}
                  </span>
                </td>
                <td>
                  <span
                    className="address-link"
                    title={trade.trade?.evmTrader}
                    onClick={() => setSelectedUserAddress({ bech32: trade.trade?.trader, evm: trade.trade?.evmTrader })}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(trade.trade?.evmTrader)}
                  </span>
                </td>
                <td>
                  <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
                    {trade.trade?.isLong ? 'Long' : 'Short'}
                  </span>
                </td>
                <td>{formatNumber(trade.trade?.leverage, 1)}x</td>
                <td>${formatNumber(trade.trade?.openPrice || 0, 2)}</td>
                <td>{trade.trade?.closePrice ? `$${formatNumber(trade.trade.closePrice, 2)}` : '-'}</td>
                <td>${formatNumber((trade.trade?.collateralAmount || 0) / 1000000, 2)}</td>
                <td className={trade.realizedPnlCollateral > 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatPnl(trade.realizedPnlCollateral / 1000000)}
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="profile-cards-mobile">
        {paginatedTrades.map((trade) => {
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
                  <span className={pnl > 0 ? 'pnl-positive profile-card-value' : 'pnl-negative profile-card-value'}>
                    {formatPnl(pnl)}
                  </span>
                </div>
              )}
              <div className="profile-card-row">
                <span className="profile-card-label">Trader</span>
                <span className="profile-card-value">
                  <span
                    className="address-link"
                    onClick={() => setSelectedUserAddress({ bech32: trade.trade?.trader, evm: trade.trade?.evmTrader })}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(trade.trade?.evmTrader || trade.trade?.trader)}
                  </span>
                </span>
                {trade.txHash && (
                  <>
                    <span className="profile-card-label">TX</span>
                    <span className="profile-card-value">
                      <a href={`${config.explorerTx}${trade.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                        {shortenHash(trade.txHash)}
                      </a>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      )}

      {selectedUserAddress && (
        <UserProfileModal address={selectedUserAddress} onClose={() => setSelectedUserAddress(null)} />
      )}
    </div>
  );
}
