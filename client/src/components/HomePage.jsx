import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTrades } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatDate, formatAddress, formatNumber, formatPrice } from '../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, shortenHash, toUsd } from '../utils/tradeHelpers';
import Stats from './ui/Stats';
import FunFacts from './ui/FunFacts';
import InsightsGrid from './InsightsGrid';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';
import DataTable from './tables/DataTable';
import TradeDetailModal from './modals/TradeDetailModal';
import ActivityChart from './charts/ActivityChart';
import VolumeChart from './charts/VolumeChart';

const PREVIEW_COUNT = 10;

// ─── Trades Preview ───────────────────────────────────────────────────────────

const TRADES_SORT_OPTIONS = [
  { key: 'time',       label: 'Time' },
  { key: 'type',       label: 'Type' },
  { key: 'market',     label: 'Market' },
  { key: 'direction',  label: 'Direction' },
  { key: 'leverage',   label: 'Leverage' },
  { key: 'collateral',   label: 'Collateral' },
  { key: 'positionSize', label: 'Position Size' },
  { key: 'pnl',          label: 'PnL' },
];

const TRADES_COLUMNS = [
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
  { key: 'positionSize',   label: 'Position Size',   sortable: true },
  { key: 'pnl',            label: 'PNL',             sortable: true },
  { key: 'txHash',         label: 'TX Hash',         sortable: false },
  { key: 'evmTxHash',      label: 'EVM TX Hash',     sortable: false },
];

const TRADES_SORT_GETTERS = {
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
  positionSize:   (t) => toUsd(t.trade?.collateralAmount, t.collateralPrice) * (parseFloat(t.trade?.leverage) || 1),
  pnl:            (t) => toUsd(t.realizedPnlCollateral, t.collateralPrice),
  collateralType: (t) => t.trade?.perpBorrowing?.collateralToken?.symbol || '',
};

function TradesPreview({ network }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useNetwork();
  const { data, loading, error } = useTrades(network);
  const [selectedTrade, setSelectedTrade] = useState(null);

  if (loading) return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="section-title">Recent Trades</h3>
        <Link to="/trades" className="preview-view-all">View all →</Link>
      </div>
      <LoadingSpinner />
    </div>
  );

  if (error) return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="section-title">Recent Trades</h3>
      </div>
      <EmptyState message={`Error: ${error}`} />
    </div>
  );

  const rows = Array.isArray(data) ? data.slice(0, PREVIEW_COUNT) : [];
  if (!rows.length) return null;

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
      case 'collateral': {
        const collUsd = toUsd(trade.trade?.collateralAmount, trade.collateralPrice);
        return <td>${formatNumber(collUsd, collUsd < 0.01 ? 6 : 2)}</td>;
      }
      case 'positionSize': {
        const collUsd = toUsd(trade.trade?.collateralAmount, trade.collateralPrice);
        const posSize = collUsd * (parseFloat(trade.trade?.leverage) || 1);
        return <td>${formatNumber(posSize, posSize < 0.01 ? 6 : 2)}</td>;
      }
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
      default:
        return <td>-</td>;
    }
  };

  const renderMobileCard = (trade, i) => {
    const pnl = toUsd(trade.realizedPnlCollateral, trade.collateralPrice);
    return (
      <div key={trade.id || i} className="profile-card clickable-row" onClick={() => setSelectedTrade(trade)}>
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
      </div>
    );
  };

  return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="section-title">Recent Trades</h3>
        <Link to="/trades" className="preview-view-all">View all →</Link>
      </div>
      <DataTable
        tableKey="home-trades"
        data={rows}
        columns={TRADES_COLUMNS}
        renderCell={renderCell}
        renderMobileCard={renderMobileCard}
        sortGetters={TRADES_SORT_GETTERS}
        defaultSortCol="time"
        defaultSortDir="desc"
        sortOptions={TRADES_SORT_OPTIONS}
        hideLock
        hideSearch
        hidePageSize
        onRowClick={(trade) => setSelectedTrade(trade)}
        getRowKey={(trade) => trade.id}
      />
      {selectedTrade && <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { network } = useNetwork();

  return (
    <>
      <Stats />
      <div className="charts-row">
        <ActivityChart />
        <VolumeChart showMethodology />
      </div>
      <TradesPreview network={network} />
      <div className="home-section">
        <h3 className="section-title">Insights</h3>
        <FunFacts />
        <InsightsGrid />
      </div>
    </>
  );
}
