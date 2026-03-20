import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTrades } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatDate, formatAddress } from '../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, toUsd } from '../utils/tradeHelpers';
import Stats from './ui/Stats';
import FunFacts from './ui/FunFacts';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';
import DataTable from './tables/DataTable';
import InsightsPage from './InsightsPage';

const PREVIEW_COUNT = 20;

// ─── Trades Preview ───────────────────────────────────────────────────────────

const TRADES_SORT_OPTIONS = [
  { key: 'time',       label: 'Time' },
  { key: 'type',       label: 'Type' },
  { key: 'market',     label: 'Market' },
  { key: 'direction',  label: 'Direction' },
  { key: 'pnl',        label: 'PnL' },
];

const TRADES_COLUMNS = [
  { key: 'time',      label: 'Time',      sortable: true },
  { key: 'type',      label: 'Type',      sortable: true },
  { key: 'market',    label: 'Market',    sortable: true },
  { key: 'direction', label: 'Direction', sortable: true },
  { key: 'pnl',       label: 'PnL',       sortable: true },
];

const TRADES_SORT_GETTERS = {
  time:      (t) => new Date(t.block?.block_ts || 0).getTime(),
  type:      (t) => t.txFailed ? `failed_${t.tradeChangeType || ''}` : (t.tradeChangeType || ''),
  market:    (t) => t.trade?.perpBorrowing?.baseToken?.symbol || '',
  direction: (t) => t.trade?.isLong ? 1 : 0,
  pnl:       (t) => toUsd(t.realizedPnlCollateral, t.collateralPrice),
};

function TradesPreview({ network }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error } = useTrades(network);

  if (loading) return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">Recent Trades</h3>
        <Link to="/trades" className="preview-view-all">View all →</Link>
      </div>
      <LoadingSpinner />
    </div>
  );

  if (error) return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">Recent Trades</h3>
      </div>
      <EmptyState message={`Error: ${error}`} />
    </div>
  );

  const rows = Array.isArray(data) ? data.slice(0, PREVIEW_COUNT) : [];
  if (!rows.length) return null;

  const renderCell = (key, trade) => {
    switch (key) {
      case 'time':
        return <td>{formatDate(trade.block?.block_ts)}</td>;
      case 'type':
        return (
          <td>
            <span className={getBadgeClass(trade.tradeChangeType, trade.txFailed)}>
              {formatTradeTypeBadge(trade.tradeChangeType, trade.txFailed)}
            </span>
          </td>
        );
      case 'market':
        return <td>{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</td>;
      case 'direction':
        return (
          <td>
            {trade.trade?.isLong != null ? (
              <span className={trade.trade.isLong ? 'badge badge-green' : 'badge badge-red'}>
                {trade.trade.isLong ? 'Long' : 'Short'}
              </span>
            ) : '-'}
          </td>
        );
      case 'pnl': {
        const pnl = toUsd(trade.realizedPnlCollateral, trade.collateralPrice);
        return (
          <td className={pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : ''}>
            {pnl !== 0 ? formatPnl(pnl) : '-'}
          </td>
        );
      }
      default:
        return <td>-</td>;
    }
  };

  const renderMobileCard = (trade, i) => {
    const pnl = toUsd(trade.realizedPnlCollateral, trade.collateralPrice);
    return (
      <div
        key={trade.id || i}
        className="profile-card clickable-row"
        onClick={() => navigate(`/trade/${trade.id}`, { state: { background: location, trade } })}
      >
        <div className="profile-card-header">
          <div className="profile-card-badges">
            <span className={getBadgeClass(trade.tradeChangeType, trade.txFailed)}>
              {formatTradeTypeBadge(trade.tradeChangeType, trade.txFailed)}
            </span>
            {trade.trade?.isLong != null && (
              <span className={trade.trade.isLong ? 'badge badge-green' : 'badge badge-red'}>
                {trade.trade.isLong ? 'Long' : 'Short'}
              </span>
            )}
            <span className="profile-card-market">{trade.trade?.perpBorrowing?.baseToken?.symbol || '-'}</span>
          </div>
          <span className="profile-card-time">{formatDate(trade.block?.block_ts)}</span>
        </div>
        {pnl !== 0 && (
          <div className="profile-card-row">
            <span className="profile-card-label">PnL</span>
            <span className={`profile-card-value ${pnl > 0 ? 'pnl-positive' : 'pnl-negative'}`}>
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
        </div>
      </div>
    );
  };

  return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">Recent Trades</h3>
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
        infoText={(total) => `${total} trades`}
      />
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { network } = useNetwork();

  return (
    <>
      <Stats />
      <FunFacts />
      <TradesPreview network={network} />
      <InsightsPage />
    </>
  );
}
