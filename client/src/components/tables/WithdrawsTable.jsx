import { useWithdraws } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { WITHDRAWS_PER_PAGE } from '../../utils/constants';
import DataTable from './DataTable';

const DEFAULT_COLUMNS = [
  { key: 'depositor',   label: 'Depositor',    sortable: false },
  { key: 'shares',      label: 'Shares',       sortable: false },
  { key: 'unlockEpoch', label: 'Unlock Epoch', sortable: false },
  { key: 'autoRedeem',  label: 'Auto Redeem',  sortable: false },
  { key: 'vault',       label: 'Vault',        sortable: false },
];

function renderCell(key, withdraw) {
  switch (key) {
    case 'depositor':   return <td title={withdraw.depositor}>{formatAddress(withdraw.depositor)}</td>;
    case 'shares':      return <td>{formatNumber(withdraw.shares)}</td>;
    case 'unlockEpoch': return <td>{withdraw.unlockEpoch || '-'}</td>;
    case 'autoRedeem':  return <td>{withdraw.autoRedeem ? 'Yes' : 'No'}</td>;
    case 'vault':       return <td>{withdraw.vault?.collateralToken?.symbol || '-'}</td>;
    default:            return <td>-</td>;
  }
}

function renderMobileCard(withdraw, i) {
  return (
    <div key={i} className="profile-card">
      <div className="profile-card-header">
        <span className="profile-card-market">{withdraw.vault?.collateralToken?.symbol || '-'} Vault</span>
        <span className="profile-card-time">Epoch {withdraw.unlockEpoch || '-'}</span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Shares</span>
        <span className="profile-card-value">{formatNumber(withdraw.shares)}</span>
        <span className="profile-card-label">Auto Redeem</span>
        <span className="profile-card-value">{withdraw.autoRedeem ? 'Yes' : 'No'}</span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Depositor</span>
        <span className="profile-card-value" title={withdraw.depositor}>{formatAddress(withdraw.depositor)}</span>
      </div>
    </div>
  );
}

export default function WithdrawsTable() {
  const { network } = useNetwork();
  const { data: withdraws, loading, error } = useWithdraws(network);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!withdraws?.length) return <EmptyState message="No withdraws found" />;

  return (
    <DataTable
      tableKey="withdraws"
      data={withdraws}
      columns={DEFAULT_COLUMNS}
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      perPage={WITHDRAWS_PER_PAGE}
      getRowKey={(_, i) => i}
      infoText={(total, start, end) => `Showing ${start}-${end} of ${total} withdraws`}
    />
  );
}
