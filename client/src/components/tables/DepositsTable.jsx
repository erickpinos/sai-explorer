import { useNavigate, useLocation } from 'react-router-dom';
import { useDeposits } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress } from '../../utils/formatters';
import { nibiToHex } from '../../utils/addressUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { DEPOSITS_PER_PAGE } from '../../utils/constants';
import DataTable from './DataTable';

const DEFAULT_COLUMNS = [
  { key: 'time',        label: 'Time',                     sortable: false },
  { key: 'action',      label: 'Action',                   sortable: false },
  { key: 'depositor',   label: 'Depositor',                sortable: false },
  { key: 'amount',      label: 'Amount',                   sortable: false },
  { key: 'token',       label: 'Token',                    sortable: false },
  { key: 'shares',      label: 'Shares',                   sortable: false },
  { key: 'block',       label: 'Block',                    sortable: false },
  { key: 'vault',       label: 'Vault (NIBI)',              sortable: false },
  { key: 'vaultShares', label: 'Vault Shares (Hardcoded)', sortable: false },
  { key: 'txHash',      label: 'TX Hash',                  sortable: false },
  { key: 'evmTxHash',   label: 'EVM TX Hash',              sortable: false },
];

export default function DepositsTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useNetwork();
  const { data: deposits, loading, error } = useDeposits(network);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!deposits?.length) return <EmptyState message="No deposits found" />;

  const renderCell = (key, deposit) => {
    switch (key) {
      case 'time':     return <td>{formatDate(deposit.block?.block_ts)}</td>;
      case 'action':   return <td><span className="badge badge-green">Deposit</span></td>;
      case 'depositor':
        return (
          <td>
            <span
              className="address-link"
              onClick={() => navigate(`/user/${nibiToHex(deposit.depositor) || deposit.depositor}`, { state: { background: location } })}
              style={{ cursor: 'pointer' }}
              title={deposit.depositor}
            >
              {formatAddress(deposit.depositor)}
            </span>
          </td>
        );
      case 'amount':   return <td>${formatNumber(deposit.amount / 1000000, 2)}</td>;
      case 'token':    return <td>{deposit.vault?.collateralToken?.symbol || '-'}</td>;
      case 'shares':   return <td>{formatNumber(deposit.shares / 1000000, 2)}</td>;
      case 'block':    return <td>{deposit.block?.block || '-'}</td>;
      case 'vault':
        return (
          <td>
            <span className="address-link" title={deposit.vault?.address}>
              {formatAddress(deposit.vault?.address)}
            </span>
          </td>
        );
      case 'vaultShares':
        return (
          <td>
            {deposit.vault?.address ? (
              <a
                href={`https://nibiscan.io/token/${nibiToHex(deposit.vault.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="address-link"
                title={nibiToHex(deposit.vault.address)}
              >
                {formatAddress(nibiToHex(deposit.vault.address))}
              </a>
            ) : '-'}
          </td>
        );
      case 'txHash':
        return (
          <td>
            {deposit.txHash ? (
              <a
                href={`https://nibiru.explorers.guru/transaction/${deposit.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="address-link"
                title={deposit.txHash}
              >
                {formatAddress(deposit.txHash)}
              </a>
            ) : '-'}
          </td>
        );
      case 'evmTxHash':
        return (
          <td>
            {deposit.evmTxHash ? (
              <a
                href={`https://nibiscan.io/tx/${deposit.evmTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="address-link"
                title={deposit.evmTxHash}
              >
                {formatAddress(deposit.evmTxHash)}
              </a>
            ) : '-'}
          </td>
        );
      default: return <td>-</td>;
    }
  };

  const renderMobileCard = (deposit, i) => (
    <div key={deposit.id || i} className="profile-card">
      <div className="profile-card-header">
        <div className="profile-card-badges">
          <span className="badge badge-green">Deposit</span>
          <span className="profile-card-market">{deposit.vault?.collateralToken?.symbol || '-'}</span>
        </div>
        <span className="profile-card-time">{formatDate(deposit.block?.block_ts)}</span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Amount</span>
        <span className="profile-card-value">${formatNumber(deposit.amount / 1000000, 2)}</span>
        <span className="profile-card-label">Shares</span>
        <span className="profile-card-value">{formatNumber(deposit.shares / 1000000, 2)}</span>
      </div>
      <div className="profile-card-row">
        <span className="profile-card-label">Depositor</span>
        <span className="profile-card-value">
          <span
            className="address-link"
            onClick={() => navigate(`/user/${nibiToHex(deposit.depositor) || deposit.depositor}`, { state: { background: location } })}
            style={{ cursor: 'pointer' }}
          >
            {formatAddress(deposit.depositor)}
          </span>
        </span>
        {deposit.txHash && (
          <>
            <span className="profile-card-label">TX</span>
            <span className="profile-card-value">
              <a href={`https://nibiru.explorers.guru/transaction/${deposit.txHash}`} target="_blank" rel="noopener noreferrer" className="address-link">
                {formatAddress(deposit.txHash)}
              </a>
            </span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <DataTable
      tableKey="deposits"
      data={deposits}
      columns={DEFAULT_COLUMNS}
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      perPage={DEPOSITS_PER_PAGE}
      getRowKey={(d, i) => d.id || i}
      infoText={(total, start, end) => `Showing ${start}-${end} of ${total} deposits`}
    />
  );
}
