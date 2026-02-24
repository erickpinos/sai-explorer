import { useState, useMemo } from 'react';
import { useCollateral } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

const SORT_KEYS = {
  tokenId: (c) => c.tokenId ?? 0,
  symbol:  (c) => c.symbol || '',
  name:    (c) => c.name || '',
  price:   (c) => c.price || 0,
};

export default function CollateralTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useCollateral(network);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (col === sortCol) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const indices = data?.collateralIndices || [];
    if (!sortCol) return indices; // API returns sorted by tokenId asc
    const getter = SORT_KEYS[sortCol];
    return [...indices].sort((a, b) => {
      const aVal = getter(a);
      const bVal = getter(b);
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortCol, sortDir]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No collateral indices found" />;

  const SortTh = ({ col, children }) => {
    const active = col === sortCol;
    return (
      <th
        className={`sortable${active ? ' sorted' : ''}`}
        onClick={() => handleSort(col)}
      >
        {children} <span className="sort-icon">{active ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}</span>
      </th>
    );
  };

  const activeIndices = data?.activeIndices || [];

  return (
    <div>
      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <SortTh col="tokenId">Index</SortTh>
              <SortTh col="symbol">Symbol</SortTh>
              <SortTh col="name">Name</SortTh>
              <SortTh col="price">Price (USD)</SortTh>
              <th>Vaults</th>
              <th>Vault TVL</th>
              <th>Markets</th>
              <th>Total OI</th>
              <th>Logo</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.tokenId ?? i}>
                <td><strong>{c.tokenId != null ? c.tokenId : '-'}</strong></td>
                <td><strong>{c.symbol}</strong></td>
                <td>{c.name}</td>
                <td>${formatNumber(c.price, 6)}</td>
                <td>{c.vaultCount}</td>
                <td>${formatNumber(c.vaultTvl, 2)}</td>
                <td>{c.marketCount}</td>
                <td>${formatNumber(c.totalOi, 2)}</td>
                <td>
                  {c.logoUrl
                    ? <img src={c.logoUrl} alt={c.symbol} className="collateral-logo" />
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="profile-cards-mobile">
        {sorted.map((c, i) => (
          <div key={c.tokenId ?? i} className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-badges">
                {c.logoUrl && <img src={c.logoUrl} alt={c.symbol} className="collateral-logo" style={{ width: '20px', height: '20px' }} />}
                <span className="profile-card-market">{c.symbol}</span>
                <span style={{ color: '#888', fontSize: '12px' }}>{c.name}</span>
              </div>
              <span className="profile-card-time">Index {c.tokenId}</span>
            </div>
            <div className="profile-card-row">
              <span className="profile-card-label">Price</span>
              <span className="profile-card-value">${formatNumber(c.price, 6)}</span>
              <span className="profile-card-label">Vaults</span>
              <span className="profile-card-value">{c.vaultCount}</span>
            </div>
            <div className="profile-card-row">
              <span className="profile-card-label">TVL</span>
              <span className="profile-card-value">${formatNumber(c.vaultTvl, 2)}</span>
              <span className="profile-card-label">Total OI</span>
              <span className="profile-card-value">${formatNumber(c.totalOi, 2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="collateral-footer">
        <h4>Discovered Collateral Indices</h4>
        <p>Active indices: {activeIndices.join(', ')}</p>
        <p className="collateral-footer-note">
          These indices were found by querying vaults and markets on the current network.
        </p>
      </div>
    </div>
  );
}
