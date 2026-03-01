import { useState, useCallback } from 'react';
import { useTrades } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress, formatPrice } from '../../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, shortenHash, toUsd } from '../../utils/tradeHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import SortTh from '../ui/SortTh';
import Pagination from '../ui/Pagination';
import UserProfileModal from '../modals/UserProfileModal';
import TradeDetailModal from '../modals/TradeDetailModal';
import { TRADES_PER_PAGE } from '../../utils/constants';
import { useViewToggle } from '../ui/ViewToggle';
import { useSortedData } from '../../hooks/useSortedData';
import { usePagination } from '../../hooks/usePagination';


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
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const { toggle, viewClass } = useViewToggle();

  const { sorted, sortCol, sortDir, handleSort: sortData } = useSortedData(trades, 'time', 'desc', SORT_GETTERS);
  const { page, setPage, paginatedData: paginatedTrades, totalPages, startIndex } = usePagination(sorted, TRADES_PER_PAGE);

  const handleSort = useCallback((col) => { sortData(col); setPage(1); }, [sortData, setPage]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No trades found" />;

  const Th = ({ col, children }) => (
    <SortTh col={col} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{children}</SortTh>
  );

  return (
    <div className={viewClass}>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(startIndex + TRADES_PER_PAGE, sorted.length)} of {sorted.length} transactions
        {toggle}
      </div>

      <div className="table-wrapper profile-table-desktop">
          <table>
            <thead>
              <tr>
                <Th col="time">Time</Th>
                <Th col="type">Type</Th>
                <Th col="marketId">Market ID</Th>
                <Th col="market">Market</Th>
                <Th col="collateralType">Collateral Type</Th>
                <Th col="trader">Trader</Th>
                <Th col="evmAddress">EVM Address</Th>
                <Th col="direction">Direction</Th>
                <Th col="leverage">Leverage</Th>
                <Th col="openPrice">Open Price</Th>
                <Th col="closePrice">Close Price</Th>
                <Th col="collateral">Collateral</Th>
                <Th col="pnl">PNL</Th>
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {selectedUserAddress && (
        <UserProfileModal address={selectedUserAddress} onClose={() => setSelectedUserAddress(null)} />
      )}

      {selectedTrade && (
        <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}
    </div>
  );
}
