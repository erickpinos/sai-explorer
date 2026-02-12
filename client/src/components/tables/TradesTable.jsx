import { useState } from 'react';
import { useTrades } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress, formatPercent } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { TRADES_PER_PAGE } from '../../utils/constants';

// Helper to get CSS class based on trade status
const getStatusClass = (status) => {
  if (!status) return '';

  const statusLower = status.toLowerCase();

  if (statusLower.includes('liquidat') || statusLower === 'position_closed_liquidation') {
    return 'status-liquidated';
  }
  if (statusLower.includes('opened') || statusLower === 'position_opened') {
    return 'status-opened';
  }
  if (statusLower.includes('closed') || statusLower === 'position_closed') {
    return 'status-closed';
  }
  if (statusLower.includes('trigger')) {
    return 'status-triggered';
  }

  return '';
};

// Helper to format trade type from snake_case to Title Case
const formatTradeType = (type) => {
  if (!type) return '-';

  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function TradesTable() {
  const { network, config } = useNetwork();
  const { data: trades, loading, error } = useTrades(network);
  const [currentPage, setCurrentPage] = useState(1);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!trades || trades.length === 0) return <EmptyState message="No trades found" />;

  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const endIndex = startIndex + TRADES_PER_PAGE;
  const paginatedTrades = trades.slice(startIndex, endIndex);
  const totalPages = Math.ceil(trades.length / TRADES_PER_PAGE);

  return (
    <div>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, trades.length)} of {trades.length} trades
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Trader</th>
              <th>Market</th>
              <th>Type</th>
              <th>Side</th>
              <th>Leverage</th>
              <th>Collateral</th>
              <th>PnL %</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTrades.map((trade) => (
              <tr key={trade.id}>
                <td>{formatDate(trade.block?.block_ts)}</td>
                <td title={trade.trade?.trader}>
                  {formatAddress(trade.trade?.trader)}
                </td>
                <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>
                <td className={getStatusClass(trade.tradeChangeType)}>
                  {formatTradeType(trade.tradeChangeType)}
                </td>
                <td className={trade.trade?.isLong ? 'long' : 'short'}>
                  {trade.trade?.isLong ? 'Long' : 'Short'}
                </td>
                <td>{formatNumber(trade.trade?.leverage, 1)}x</td>
                <td>${formatNumber(trade.trade?.collateralAmount || 0)}</td>
                <td className={trade.realizedPnlPct > 0 ? 'positive' : 'negative'}>
                  {formatPercent(trade.realizedPnlPct)}
                </td>
                <td>
                  {trade.evmTxHash ? (
                    <a
                      href={`${config.explorerTx}${trade.evmTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
