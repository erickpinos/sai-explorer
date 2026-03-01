import { useState } from 'react';
import { useVolume } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatAddress } from '../../utils/formatters';
import { formatPnl } from '../../utils/tradeHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import UserProfileModal from '../modals/UserProfileModal';
import { useViewToggle } from '../ui/ViewToggle';
import { useSortedData } from '../../hooks/useSortedData';

const COLUMNS = [
  { key: 'totalVolume',  label: 'Total Volume' },
  { key: 'tradeCount',   label: 'Trades' },
  { key: 'realizedPnl',  label: 'Realized PnL' },
  { key: 'opens',        label: 'Opens' },
  { key: 'closes',       label: 'Closes' },
  { key: 'liquidations', label: 'Liquidations' },
  { key: 'firstTradeTs', label: 'First Trade' },
  { key: 'lastTradeTs',  label: 'Last Trade' },
];

export default function VolumeTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useVolume(network);
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);
  const { toggle, viewClass } = useViewToggle();

  const { sorted, sortCol, sortDir, handleSort } = useSortedData(data?.users || [], 'totalVolume', 'desc', null);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No trader data found" />;

  const SortIcon = ({ col }) => {
    if (col !== sortCol) return <span className="sort-icon">▼</span>;
    return <span className="sort-icon" style={{ opacity: 1, color: '#6366f1' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>;
  };

  return (
    <div className={viewClass}>
      <div className="table-info">
        {sorted.length} traders
        {toggle}
      </div>

      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="sortable" onClick={() => handleSort('trader')}>
                Trader <SortIcon col="trader" />
              </th>
              {COLUMNS.map(({ key, label }) => (
                <th key={key} className="sortable" onClick={() => handleSort(key)}>
                  {label} <SortIcon col={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => (
              <tr key={u.trader}>
                <td>{i + 1}</td>
                <td>
                  <span
                    className="address-link"
                    title={u.evmTrader || u.trader}
                    onClick={() => setSelectedUserAddress({ bech32: u.trader, evm: u.evmTrader })}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatAddress(u.evmTrader || u.trader)}
                  </span>
                </td>
                <td>${formatNumber(u.totalVolume, 2)}</td>
                <td>{u.tradeCount}</td>
                <td className={u.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {formatPnl(u.realizedPnl)}
                </td>
                <td>{u.opens}</td>
                <td>{u.closes}</td>
                <td>{u.liquidations}</td>
                <td>{u.firstTradeTs ? new Date(u.firstTradeTs).toLocaleDateString() : '—'}</td>
                <td>{u.lastTradeTs ? new Date(u.lastTradeTs).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="profile-cards-mobile">
        {sorted.map((u, i) => (
          <div key={u.trader} className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-badges">
                <span className="profile-card-rank">#{i + 1}</span>
                <span
                  className="address-link profile-card-market"
                  onClick={() => setSelectedUserAddress({ bech32: u.trader, evm: u.evmTrader })}
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
        ))}
      </div>

      {selectedUserAddress && (
        <UserProfileModal
          address={selectedUserAddress}
          onClose={() => setSelectedUserAddress(null)}
        />
      )}
    </div>
  );
}
