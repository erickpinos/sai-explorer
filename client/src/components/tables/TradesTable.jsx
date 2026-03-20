import { useNavigate, useLocation } from 'react-router-dom';
import { useTrades } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress, formatPrice } from '../../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, shortenHash, toUsd } from '../../utils/tradeHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { TRADES_PER_PAGE } from '../../utils/constants';
import DataTable from './DataTable';

const SORT_OPTIONS = [
  { key: 'time',       label: 'Time' },
  { key: 'type',       label: 'Type' },
  { key: 'market',     label: 'Market' },
  { key: 'direction',  label: 'Direction' },
  { key: 'leverage',   label: 'Leverage' },
  { key: 'collateral', label: 'Collateral' },
  { key: 'pnl',        label: 'PnL' },
];

const SORT_GETTERS = {
  time:           (t) => new Date(t.block?.block_ts || 0).getTime(),
  type:           (t) => t.txFailed ? `failed_${t.tradeChangeType || ''}` : (t.tradeChangeType || ''),
  market:         (t) => t.trade?.perpBorrowing?.baseToken?.symbol || '',
  marketId:       (t) => t.trade?.perpBorrowing?.marketId ?? 0,
  trader:         (t) => t.trade?.trader || '',
  evmAddress:     (t) => t.trade?.evmTrader || '',
  direction:      (t) => t.trade?.isLong ? 1 : 0,
  leverage:       (t) => parseFloat(t.trade?.leverage) || 0,
  openPrice:      (t) => parseFloat(t.trade?.openPrice) || 0,
  closePrice:     (t) => parseFloat(t.trade?.closePrice) || 0,
  collateral:     (t) => toUsd(t.trade?.collateralAmount, t.collateralPrice),
  pnl:            (t) => toUsd(t.realizedPnlCollateral, t.collateralPrice),
  collateralType: (t) => t.trade?.perpBorrowing?.collateralToken?.symbol || '',
  devNote:        (t) => t.devNote || '',
};

const DEFAULT_COLUMNS = [
  { key: 'time',           label: 'Time',            sortable: true },
  { key: 'type',           label: 'Type',            sortable: true },
  { key: 'marketId',       label: 'Market ID',       sortable: true },
  { key: 'market',         label: 'Market',          sortable: true },
  { key: 'collateralType', label: 'Collateral Type', sortable: true },
  { key: 'trader',         label: 'Trader',          sortable: true },
  { key: 'evmAddress',     label: 'EVM Address',     sortable: true },
  { key: 'direction',      label: 'Direction',       sortable: true },
  { key: 'leverage',       label: 'Leverage',        sortable: true },
  { key: 'openPrice',      label: 'Open Price',      sortable: true },
  { key: 'closePrice',     label: 'Close Price',     sortable: true },
  { key: 'collateral',     label: 'Collateral',      sortable: true },
  { key: 'pnl',            label: 'PNL',             sortable: true },
  { key: 'txHash',         label: 'TX Hash',         sortable: false },
  { key: 'evmTxHash',      label: 'EVM TX Hash',     sortable: false },
  ...(import.meta.env.DEV ? [{ key: 'devNote', label: 'Dev Notes', sortable: true }] : []),
];

export default function TradesTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const { network, config } = useNetwork();
  const { data: trades, loading, error } = useTrades(network);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!trades?.length) return <EmptyState message="No trades found" />;

  const renderCell = (key, trade) => {
    const displayType = (
      trade.trade?.tradeType === 'limit' &&
      trade.tradeChangeType?.toLowerCase().includes('closed') &&
      !parseFloat(trade.trade?.closePrice) &&
      !parseFloat(trade.realizedPnlCollateral)
    ) ? 'limit_order_cancelled' : trade.tradeChangeType;

    switch (key) {
      case 'time':
        return <td>{formatDate(trade.block?.block_ts)}</td>;
      case 'type':
        return (
          <td>
            <span className={getBadgeClass(displayType, trade.txFailed)}>
              {formatTradeTypeBadge(displayType, trade.txFailed)}
            </span>
          </td>
        );
      case 'marketId':
        return <td><strong>{trade.trade?.perpBorrowing?.marketId != null ? trade.trade.perpBorrowing.marketId : '-'}</strong></td>;
      case 'market':
        return <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>;
      case 'collateralType':
        return (
          <td>
            <span className="badge badge-purple" style={{ fontSize: '11px' }}>
              {trade.trade?.perpBorrowing?.collateralToken?.symbol || '-'}
            </span>
          </td>
        );
      case 'trader':
        return (
          <td>
            <span
              className="address-link"
              title={trade.trade?.trader}
              onClick={(e) => { e.stopPropagation(); navigate(`/user/${trade.trade?.evmTrader || trade.trade?.trader}`, { state: { background: location } }); }}
              style={{ cursor: 'pointer' }}
            >
              {formatAddress(trade.trade?.trader)}
            </span>
          </td>
        );
      case 'evmAddress':
        return (
          <td>
            <span
              className="address-link"
              title={trade.trade?.evmTrader}
              onClick={(e) => { e.stopPropagation(); navigate(`/user/${trade.trade?.evmTrader || trade.trade?.trader}`, { state: { background: location } }); }}
              style={{ cursor: 'pointer' }}
            >
              {formatAddress(trade.trade?.evmTrader)}
            </span>
          </td>
        );
      case 'direction':
        return (
          <td>
            <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
              {trade.trade?.isLong ? 'Long' : 'Short'}
            </span>
          </td>
        );
      case 'leverage':
        return <td>{formatNumber(trade.trade?.leverage, 1)}x</td>;
      case 'openPrice':
        return <td>{formatPrice(trade.trade?.openPrice || 0)}</td>;
      case 'closePrice':
        return <td>{parseFloat(trade.trade?.closePrice) > 0 ? formatPrice(trade.trade.closePrice) : '-'}</td>;
      case 'collateral':
        return <td>${formatNumber(toUsd(trade.trade?.collateralAmount, trade.collateralPrice), 2)}</td>;
      case 'pnl':
        return (
          <td className={trade.realizedPnlCollateral > 0 ? 'pnl-positive' : 'pnl-negative'}>
            {formatPnl(toUsd(trade.realizedPnlCollateral, trade.collateralPrice))}
          </td>
        );
      case 'txHash':
        return (
          <td onClick={(e) => e.stopPropagation()}>
            {trade.txHash ? (
              <a href={`${config.explorerTx}${trade.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                {shortenHash(trade.txHash)}
              </a>
            ) : '-'}
          </td>
        );
      case 'evmTxHash':
        return (
          <td onClick={(e) => e.stopPropagation()}>
            {trade.evmTxHash ? (
              <a href={`${config.explorerEvmTx}${trade.evmTxHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                {shortenHash(trade.evmTxHash)}
              </a>
            ) : '-'}
          </td>
        );
      case 'devNote':
        return (
          <td style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
            {trade.devNote ? `⚠ ${trade.devNote}` : ''}
          </td>
        );
      default:
        return <td>-</td>;
    }
  };

  const renderMobileCard = (trade) => {
    const pnl = toUsd(trade.realizedPnlCollateral, trade.collateralPrice);
    return (
      <div key={trade.id} className="profile-card clickable-row" onClick={() => navigate(`/trade/${trade.id}`, { state: { background: location, trade } })}>
        <div className="profile-card-header">
          <div className="profile-card-badges">
            <span className={getBadgeClass(trade.tradeChangeType, trade.txFailed)}>
              {formatTradeTypeBadge(trade.tradeChangeType, trade.txFailed)}
            </span>
            <span className={trade.trade?.isLong ? 'badge badge-green' : 'badge badge-red'}>
              {trade.trade?.isLong ? 'Long' : 'Short'}
            </span>
            <span className="profile-card-time" style={{ fontSize: '12px', color: '#888' }}>ID {trade.trade?.perpBorrowing?.marketId ?? '-'}</span>
            <span className="profile-card-market">{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</span>
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
              onClick={(e) => { e.stopPropagation(); navigate(`/user/${trade.trade?.evmTrader || trade.trade?.trader}`, { state: { background: location } }); }}
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
        {import.meta.env.DEV && trade.devNote && (
          <div className="profile-card-row" style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>
            ⚠ {trade.devNote}
          </div>
        )}
      </div>
    );
  };

  return (
    <DataTable
      tableKey="trades"
      data={trades}
      columns={DEFAULT_COLUMNS}
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      sortGetters={SORT_GETTERS}
      defaultSortCol="time"
      defaultSortDir="desc"
      sortOptions={SORT_OPTIONS}
      perPage={TRADES_PER_PAGE}
      onRowClick={(trade) => navigate(`/trade/${trade.id}`, { state: { background: location, trade } })}
      getRowKey={(trade) => trade.id}
      infoText={(total, start, end) => `Showing ${start}-${Math.min(end, total)} of ${total} transactions`}
    />
  );
}
