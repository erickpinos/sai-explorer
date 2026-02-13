import { useState } from 'react';
import { useTrades } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import UserProfileModal from '../modals/UserProfileModal';
import { TRADES_PER_PAGE } from '../../utils/constants';

// Helper to get badge class based on trade status
const getBadgeClass = (status) => {
  if (!status) return 'badge badge-purple';

  const statusLower = status.toLowerCase();

  if (statusLower.includes('liquidat') || statusLower === 'position_closed_liquidation') {
    return 'badge badge-red';
  }
  if (statusLower.includes('opened') || statusLower === 'position_opened') {
    return 'badge badge-blue';
  }
  if (statusLower.includes('closed') || statusLower === 'position_closed') {
    return 'badge badge-purple';
  }
  if (statusLower.includes('trigger')) {
    return 'badge badge-yellow';
  }

  return 'badge badge-purple';
};

// Helper to format trade type to short badge text
const formatTradeTypeBadge = (type) => {
  if (!type) return 'Unknown';

  const statusLower = type.toLowerCase();

  if (statusLower.includes('liquidat')) return 'Liquidated';
  if (statusLower.includes('opened')) return 'Opened';
  if (statusLower.includes('closed')) return 'Closed';
  if (statusLower.includes('trigger')) return 'Triggered';

  // Fallback to title case
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper to format PnL with sign and color
const formatPnl = (pnl) => {
  if (!pnl || pnl === 0) return '-';
  const sign = pnl > 0 ? '+' : '';
  return `${sign}$${formatNumber(Math.abs(pnl), 2)}`;
};

// Helper to shorten transaction hash
const shortenHash = (hash) => {
  if (!hash) return '-';
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
};

export default function TradesTable() {
  const { network, config } = useNetwork();
  const { data: trades, loading, error } = useTrades(network);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);

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
              <th className="sortable">Time ▼</th>
              <th className="sortable">Type ▼</th>
              <th className="sortable">Market ▼</th>
              <th className="sortable">Trader ▼</th>
              <th className="sortable">EVM Address ▼</th>
              <th className="sortable">Direction ▼</th>
              <th className="sortable">Leverage ▼</th>
              <th className="sortable">Open Price ▼</th>
              <th className="sortable">Close Price ▼</th>
              <th className="sortable">Collateral ▼</th>
              <th className="sortable">PNL ▼</th>
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
                    onClick={() => setSelectedUserAddress({
                      bech32: trade.trade?.trader,
                      evm: trade.trade?.evmTrader
                    })}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(trade.trade?.trader)}
                  </span>
                </td>
                <td>
                  <span
                    className="address-link"
                    title={trade.trade?.evmTrader}
                    onClick={() => setSelectedUserAddress({
                      bech32: trade.trade?.trader,
                      evm: trade.trade?.evmTrader
                    })}
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
                <td>
                  {trade.trade?.closePrice
                    ? `$${formatNumber(trade.trade.closePrice, 2)}`
                    : '-'}
                </td>
                <td>${formatNumber((trade.trade?.collateralAmount || 0) / 1000000, 2)}</td>
                <td className={trade.realizedPnlCollateral > 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatPnl(trade.realizedPnlCollateral / 1000000)}
                </td>
                <td>
                  {trade.txHash ? (
                    <a
                      href={`${config.explorerTx}${trade.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-hash"
                    >
                      {shortenHash(trade.txHash)}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {trade.evmTxHash ? (
                    <a
                      href={`${config.explorerEvmTx}${trade.evmTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-hash"
                    >
                      {shortenHash(trade.evmTxHash)}
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

      {selectedUserAddress && (
        <UserProfileModal
          address={selectedUserAddress}
          onClose={() => setSelectedUserAddress(null)}
        />
      )}
    </div>
  );
}
