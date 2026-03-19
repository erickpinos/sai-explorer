import { useNavigate, useLocation } from 'react-router-dom';
import { useVolume } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatAddress } from '../../utils/formatters';
import { formatPnl } from '../../utils/tradeHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import DataTable from './DataTable';

const SORT_OPTIONS = [
  { key: 'trader',       label: 'Trader' },
  { key: 'totalVolume',  label: 'Total Volume' },
  { key: 'tradeCount',   label: 'Trades' },
  { key: 'realizedPnl',  label: 'Realized PnL' },
  { key: 'opens',        label: 'Opens' },
  { key: 'closes',       label: 'Closes' },
  { key: 'liquidations', label: 'Liquidations' },
  { key: 'firstTradeTs', label: 'First Trade' },
  { key: 'lastTradeTs',  label: 'Last Trade' },
];

const DEFAULT_COLUMNS = [
  { key: 'rank',         label: '#',            sortable: false },
  { key: 'trader',       label: 'Trader',       sortable: true },
  { key: 'totalVolume',  label: 'Total Volume', sortable: true },
  { key: 'tradeCount',   label: 'Trades',       sortable: true },
  { key: 'realizedPnl',  label: 'Realized PnL', sortable: true },
  { key: 'opens',        label: 'Opens',        sortable: true },
  { key: 'closes',       label: 'Closes',       sortable: true },
  { key: 'liquidations', label: 'Liquidations', sortable: true },
  { key: 'firstTradeTs', label: 'First Trade',  sortable: true },
  { key: 'lastTradeTs',  label: 'Last Trade',   sortable: true },
];

export default function VolumeTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useNetwork();
  const { data, loading, error } = useVolume(network);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!data?.users?.length) return <EmptyState message="No trader data found" />;

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
      case 'firstTradeTs': return <td>{u.firstTradeTs ? new Date(u.firstTradeTs).toLocaleDateString() : '—'}</td>;
      case 'lastTradeTs':  return <td>{u.lastTradeTs ? new Date(u.lastTradeTs).toLocaleDateString() : '—'}</td>;
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
    <DataTable
      tableKey="volume"
      data={data.users}
      columns={DEFAULT_COLUMNS}
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      sortGetters={null}
      defaultSortCol="totalVolume"
      defaultSortDir="desc"
      sortOptions={SORT_OPTIONS}
      getRowKey={(u, i) => `${u.trader}-${u.evmTrader || i}`}
      infoText={(total) => `${total} traders`}
    />
  );
}
