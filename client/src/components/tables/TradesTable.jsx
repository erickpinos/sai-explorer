import { useState, useMemo } from 'react';
import { useTrades } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress, formatPrice } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import UserProfileModal from '../modals/UserProfileModal';
import TradeDetailModal from '../modals/TradeDetailModal';
import { TRADES_PER_PAGE } from '../../utils/constants';
import { useViewToggle } from '../ui/ViewToggle';

const getBadgeClass = (status) => {
  if (!status) return 'badge badge-purple';
  const s = status.toLowerCase();
  if (s.includes('liquidat')) return 'badge badge-red';
  if (s.includes('opened')) return 'badge badge-blue';
  if (s.includes('cancel')) return 'badge badge-orange';
  if (s.includes('closed')) return 'badge badge-purple';
  if (s.includes('trigger')) return 'badge badge-yellow';
  return 'badge badge-purple';
};

const formatTradeTypeBadge = (type) => {
  if (!type) return 'Unknown';
  const s = type.toLowerCase();
  if (s.includes('liquidat')) return 'Liquidated';
  if (s.includes('opened')) return 'Opened';
  if (s.includes('cancel')) return 'Limit Order Cancelled';
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

const toUsd = (microAmount, collateralPrice) => {
  const raw = (parseFloat(microAmount) || 0) / 1000000;
  const price = parseFloat(collateralPrice) || 1;
  return raw * price;
};

const SORT_GETTERS = {
  time:       (t) => new Date(t.block?.block_ts || 0).getTime(),
  type:       (t) => t.tradeChangeType || '',
  market:     (t) => t.trade?.perpBorrowing?.baseToken?.symbol || '',
  marketId:   (t) => t.trade?.perpBorrowing?.marketId ?? 0,
  trader:     (t) => t.trade?.trader || '',
  evmAddress: (t) => t.trade?.evmTrader || '',
  direction:  (t) => t.trade?.isLong ? 1 : 0,
  leverage:   (t) => parseFloat(t.trade?.leverage) || 0,
  openPrice:  (t) => parseFloat(t.trade?.openPrice) || 0,
  closePrice: (t) => parseFloat(t.trade?.closePrice) || 0,
  collateral: (t) => toUsd(t.trade?.collateralAmount, t.collateralPrice),
  pnl:        (t) => toUsd(t.realizedPnlCollateral, t.collateralPrice),
  collateralType: (t) => t.trade?.perpBorrowing?.collateralToken?.symbol || '',
};

export default function TradesTable() {
  const { network, config } = useNetwork();
  const { data: trades, loading, error } = useTrades(network);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [sortCol, setSortCol] = useState('time');
  const { toggle, viewClass } = useViewToggle();
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
    <div className={viewClass}>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, sorted.length)} of {sorted.length} transactions
        {toggle}
      </div>

      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <SortTh col="time">Time</SortTh>
              <SortTh col="type">Type</SortTh>
              <SortTh col="marketId">Market ID</SortTh>
              <SortTh col="market">Market</SortTh>
              <SortTh col="collateralType">Collateral Type</SortTh>
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
            {paginatedTrades.map((trade) => {
              const displayType = (
                trade.trade?.tradeType === 'limit' &&
                trade.tradeChangeType?.toLowerCase().includes('closed') &&
                !parseFloat(trade.trade?.closePrice) &&
                !parseFloat(trade.realizedPnlCollateral)
              ) ? 'limit_order_cancelled' : trade.tradeChangeType;
              return (
              <tr key={trade.id} className="clickable-row" onClick={() => setSelectedTrade(trade)}>
                <td>{formatDate(trade.block?.block_ts)}</td>
                <td>
                  <span className={getBadgeClass(displayType)}>
                    {formatTradeTypeBadge(displayType)}
                  </span>
                </td>
                <td><strong>{trade.trade?.perpBorrowing?.marketId != null ? trade.trade.perpBorrowing.marketId : '-'}</strong></td>
                <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>
                <td><span className="badge badge-purple" style={{ fontSize: '11px' }}>{trade.trade?.perpBorrowing?.collateralToken?.symbol || '-'}</span></td>
                <td>
                  <span
                    className="address-link"
                    title={trade.trade?.trader}
                    onClick={(e) => { e.stopPropagation(); setSelectedUserAddress({ bech32: trade.trade?.trader, evm: trade.trade?.evmTrader }); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(trade.trade?.trader)}
                  </span>
                </td>
                <td>
                  <span
                    className="address-link"
                    title={trade.trade?.evmTrader}
                    onClick={(e) => { e.stopPropagation(); setSelectedUserAddress({ bech32: trade.trade?.trader, evm: trade.trade?.evmTrader }); }}
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
                <td>{formatPrice(trade.trade?.openPrice || 0)}</td>
                <td>{parseFloat(trade.trade?.closePrice) > 0 ? formatPrice(trade.trade.closePrice) : '-'}</td>
                <td>${formatNumber(toUsd(trade.trade?.collateralAmount, trade.collateralPrice), 2)}</td>
                <td className={trade.realizedPnlCollateral > 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatPnl(toUsd(trade.realizedPnlCollateral, trade.collateralPrice))}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {trade.txHash ? (
                    <a href={`${config.explorerTx}${trade.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {shortenHash(trade.txHash)}
                    </a>
                  ) : '-'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
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

      <div className="profile-cards-mobile">
        {paginatedTrades.map((trade) => {
          const pnl = toUsd(trade.realizedPnlCollateral, trade.collateralPrice);
          return (
            <div key={trade.id} className="profile-card clickable-row" onClick={() => setSelectedTrade(trade)}>
              <div className="profile-card-header">
                <div className="profile-card-badges">
                  <span className={getBadgeClass(trade.tradeChangeType)}>
                    {formatTradeTypeBadge(trade.tradeChangeType)}
                  </span>
                  <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
                    {trade.trade?.isLong ? 'Long' : 'Short'}
                  </span>
                  <span className="profile-card-time" style={{ fontSize: '12px', color: '#888' }}>ID {trade.trade?.perpBorrowing?.marketId ?? '-'}</span>
                  <span className="profile-card-market">
                    {trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}
                  </span>
                  <span className="badge badge-purple" style={{ fontSize: '11px' }}>{trade.trade?.perpBorrowing?.collateralToken?.symbol || '-'}</span>
                </div>
                <span className="profile-card-time">{formatDate(trade.block?.block_ts)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Leverage</span>
                <span className="profile-card-value">{formatNumber(trade.trade?.leverage, 1)}x</span>
                <span className="profile-card-label">Collateral</span>
                <span className="profile-card-value">${formatNumber(toUsd(trade.trade?.collateralAmount, trade.collateralPrice), 2)}</span>
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
                    onClick={(e) => { e.stopPropagation(); setSelectedUserAddress({ bech32: trade.trade?.trader, evm: trade.trade?.evmTrader }); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(trade.trade?.evmTrader || trade.trade?.trader)}
                  </span>
                </span>
                {trade.txHash && (
                  <>
                    <span className="profile-card-label">TX</span>
                    <span className="profile-card-value" onClick={(e) => e.stopPropagation()}>
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

      {selectedTrade && (
        <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}
    </div>
  );
}
