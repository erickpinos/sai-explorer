import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTrades, useVolume } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress } from '../utils/formatters';
import { getBadgeClass, formatTradeTypeBadge, formatPnl, toUsd } from '../utils/tradeHelpers';
import Stats from './ui/Stats';
import FunFacts from './ui/FunFacts';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';
import DataTable from './tables/DataTable';

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

// ─── User Stats Preview ───────────────────────────────────────────────────────

const STATS_SORT_OPTIONS = [
  { key: 'trader',      label: 'Trader' },
  { key: 'totalVolume', label: 'Total Volume' },
  { key: 'tradeCount',  label: 'Trades' },
  { key: 'realizedPnl', label: 'Realized PnL' },
  { key: 'opens',       label: 'Opens' },
  { key: 'closes',      label: 'Closes' },
  { key: 'liquidations',label: 'Liquidations' },
];

const STATS_COLUMNS = [
  { key: 'rank',         label: '#',            sortable: false },
  { key: 'trader',       label: 'Trader',       sortable: true },
  { key: 'totalVolume',  label: 'Total Volume', sortable: true },
  { key: 'tradeCount',   label: 'Trades',       sortable: true },
  { key: 'realizedPnl',  label: 'Realized PnL', sortable: true },
  { key: 'opens',        label: 'Opens',        sortable: true },
  { key: 'closes',       label: 'Closes',       sortable: true },
  { key: 'liquidations', label: 'Liquidations', sortable: true },
];

function UserStatsPreview({ network }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error } = useVolume(network);

  if (loading) return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">User Stats</h3>
        <Link to="/volume" className="preview-view-all">View all →</Link>
      </div>
      <LoadingSpinner />
    </div>
  );

  if (error) return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">User Stats</h3>
      </div>
      <EmptyState message={`Error: ${error}`} />
    </div>
  );

  const rows = data?.users ? data.users.slice(0, PREVIEW_COUNT) : [];
  if (!rows.length) return null;

  const renderCell = (key, u, rowIndex) => {
    switch (key) {
      case 'rank':
        return <td>{rowIndex + 1}</td>;
      case 'trader':
        return (
          <td>
            <span
              className="address-link"
              title={u.evmTrader || u.trader}
              onClick={(e) => { e.stopPropagation(); navigate(`/user/${u.evmTrader || u.trader}`, { state: { background: location } }); }}
              style={{ cursor: 'pointer' }}
            >
              {formatAddress(u.evmTrader || u.trader)}
            </span>
          </td>
        );
      case 'totalVolume':  return <td>${formatNumber(u.totalVolume, 2)}</td>;
      case 'tradeCount':   return <td>{u.tradeCount}</td>;
      case 'realizedPnl':
        return (
          <td className={u.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
            {formatPnl(u.realizedPnl)}
          </td>
        );
      case 'opens':        return <td>{u.opens}</td>;
      case 'closes':       return <td>{u.closes}</td>;
      case 'liquidations': return <td>{u.liquidations}</td>;
      default:             return <td>-</td>;
    }
  };

  const renderMobileCard = (u, i) => (
    <div key={`${u.trader}-${u.evmTrader || i}`} className="profile-card">
      <div className="profile-card-header">
        <div className="profile-card-badges">
          <span className="profile-card-rank">#{i + 1}</span>
          <span
            className="address-link profile-card-market"
            onClick={() => navigate(`/user/${u.evmTrader || u.trader}`, { state: { background: location } })}
            style={{ cursor: 'pointer' }}
            title={u.evmTrader || u.trader}
          >
            {formatAddress(u.evmTrader || u.trader)}
          </span>
        </div>
        {u.lastTradeTs && <span className="profile-card-time">Last: {new Date(u.lastTradeTs).toLocaleDateString()}</span>}
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Volume</span>
        <span className="profile-card-value">${formatNumber(u.totalVolume, 2)}</span>
        <span className="profile-card-label">Trades</span>
        <span className="profile-card-value">{u.tradeCount}</span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">PnL</span>
        <span className={`profile-card-value ${u.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{formatPnl(u.realizedPnl)}</span>
        <span className="profile-card-label">Liquidations</span>
        <span className="profile-card-value">{u.liquidations}</span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Opens</span>
        <span className="profile-card-value">{u.opens}</span>
        <span className="profile-card-label">Closes</span>
        <span className="profile-card-value">{u.closes}</span>
      </div>
    </div>
  );

  return (
    <div className="preview-section">
      <div className="preview-header">
        <h3 className="preview-title">User Stats</h3>
        <Link to="/volume" className="preview-view-all">View all →</Link>
      </div>
      <DataTable
        tableKey="home-volume"
        data={rows}
        columns={STATS_COLUMNS}
        renderCell={renderCell}
        renderMobileCard={renderMobileCard}
        sortGetters={null}
        defaultSortCol="totalVolume"
        defaultSortDir="desc"
        sortOptions={STATS_SORT_OPTIONS}
        getRowKey={(u, i) => `${u.trader}-${u.evmTrader || i}`}
        infoText={(total) => `${total} traders`}
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
      <div className="preview-grid">
        <TradesPreview network={network} />
        <UserStatsPreview network={network} />
      </div>
    </>
  );
}
