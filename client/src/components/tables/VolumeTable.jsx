import { useState, useMemo } from 'react';
import { useVolume } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import UserProfileModal from '../modals/UserProfileModal';

const COLUMNS = [
  { key: 'totalVolume',  label: 'Total Volume' },
  { key: 'tradeCount',   label: 'Trades' },
  { key: 'realizedPnl',  label: 'Realized PnL' },
  { key: 'opens',        label: 'Opens' },
  { key: 'closes',       label: 'Closes' },
  { key: 'liquidations', label: 'Liquidations' },
];

export default function VolumeTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useVolume(network);
  const [sortCol, setSortCol] = useState('totalVolume');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);

  const handleSort = (col) => {
    if (col === sortCol) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const users = data?.users || [];
    return [...users].sort((a, b) => {
      const aVal = a[sortCol] ?? 0;
      const bVal = b[sortCol] ?? 0;
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortCol, sortDir]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No trader data found" />;

  const SortIcon = ({ col }) => {
    if (col !== sortCol) return <span className="sort-icon">▼</span>;
    return <span className="sort-icon" style={{ opacity: 1, color: '#6366f1' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>;
  };

  const formatPnl = (val) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}$${formatNumber(Math.abs(val), 2)}`;
  };

  return (
    <div>
      <div className="table-info">
        {sorted.length} traders
      </div>

      <div className="table-wrapper">
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
              </tr>
            ))}
          </tbody>
        </table>
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
