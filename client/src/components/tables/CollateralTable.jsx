import { useCollateral } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { useSortedData } from '../../hooks/useSortedData';
import DataTable from './DataTable';

const SORT_OPTIONS = [
  { key: 'tokenId',    label: 'Index' },
  { key: 'symbol',     label: 'Symbol' },
  { key: 'name',       label: 'Name' },
  { key: 'price',      label: 'Price' },
  { key: 'vaultCount', label: 'Vaults' },
  { key: 'vaultTvl',   label: 'Vault TVL' },
  { key: 'marketCount',label: 'Markets' },
  { key: 'totalOi',    label: 'Total OI' },
];

const SORT_GETTERS = {
  tokenId:     (c) => c.tokenId ?? 0,
  symbol:      (c) => c.symbol || '',
  name:        (c) => c.name || '',
  price:       (c) => c.price || 0,
  vaultCount:  (c) => c.vaultCount || 0,
  vaultTvl:    (c) => c.vaultTvl || 0,
  marketCount: (c) => c.marketCount || 0,
  totalOi:     (c) => c.totalOi || 0,
};

const DEFAULT_COLUMNS = [
  { key: 'tokenId',    label: 'Index',      sortable: true },
  { key: 'symbol',     label: 'Symbol',     sortable: true },
  { key: 'name',       label: 'Name',       sortable: true },
  { key: 'price',      label: 'Price (USD)', sortable: true },
  { key: 'vaultCount', label: 'Vaults',     sortable: true },
  { key: 'vaultTvl',   label: 'Vault TVL',  sortable: true },
  { key: 'marketCount',label: 'Markets',    sortable: true },
  { key: 'totalOi',    label: 'Total OI',   sortable: true },
  { key: 'logo',       label: 'Logo',       sortable: false },
];

function renderCell(key, c) {
  switch (key) {
    case 'tokenId':    return <td><strong>{c.tokenId != null ? c.tokenId : '-'}</strong></td>;
    case 'symbol':     return <td><strong>{c.symbol}</strong></td>;
    case 'name':       return <td>{c.name}</td>;
    case 'price':      return <td>${formatNumber(c.price, 6)}</td>;
    case 'vaultCount': return <td>{c.vaultCount}</td>;
    case 'vaultTvl':   return <td>${formatNumber(c.vaultTvl, 2)}</td>;
    case 'marketCount':return <td>{c.marketCount}</td>;
    case 'totalOi':    return <td>${formatNumber(c.totalOi, 2)}</td>;
    case 'logo':       return <td>{c.logoUrl ? <img src={c.logoUrl} alt={c.symbol} className="collateral-logo" /> : '-'}</td>;
    default:           return <td>-</td>;
  }
}

function renderMobileCard(c, i) {
  return (
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
  );
}

export default function CollateralTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useCollateral(network);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!data?.collateralIndices?.length) return <EmptyState message="No collateral indices found" />;

  const activeIndices = data.activeIndices || [];
  const footer = (
    <div className="collateral-footer">
      <h4>Discovered Collateral Indices</h4>
      <p>Active indices: {activeIndices.join(', ')}</p>
      <p className="collateral-footer-note">
        These indices were found by querying vaults and markets on the current network.
      </p>
    </div>
  );

  return (
    <DataTable
      tableKey="collateral"
      data={data.collateralIndices}
      columns={DEFAULT_COLUMNS}
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      sortGetters={SORT_GETTERS}
      defaultSortCol={null}
      defaultSortDir="asc"
      sortOptions={SORT_OPTIONS}
      getRowKey={(c, i) => c.tokenId ?? i}
      infoText={(total) => `${total} indices`}
      footer={footer}
    />
  );
}
