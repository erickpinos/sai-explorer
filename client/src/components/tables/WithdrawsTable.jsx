import { useState } from 'react';
import { useWithdraws } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { WITHDRAWS_PER_PAGE } from '../../utils/constants';

export default function WithdrawsTable() {
  const { network } = useNetwork();
  const { data: withdraws, loading, error } = useWithdraws(network);
  const [currentPage, setCurrentPage] = useState(1);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!withdraws || withdraws.length === 0) return <EmptyState message="No withdraws found" />;

  const startIndex = (currentPage - 1) * WITHDRAWS_PER_PAGE;
  const endIndex = startIndex + WITHDRAWS_PER_PAGE;
  const paginatedWithdraws = withdraws.slice(startIndex, endIndex);
  const totalPages = Math.ceil(withdraws.length / WITHDRAWS_PER_PAGE);

  return (
    <div>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, withdraws.length)} of {withdraws.length} withdraws
      </div>

      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Depositor</th>
              <th>Shares</th>
              <th>Unlock Epoch</th>
              <th>Auto Redeem</th>
              <th>Vault</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWithdraws.map((withdraw, index) => (
              <tr key={index}>
                <td title={withdraw.depositor}>
                  {formatAddress(withdraw.depositor)}
                </td>
                <td>{formatNumber(withdraw.shares)}</td>
                <td>{withdraw.unlockEpoch || '-'}</td>
                <td>{withdraw.autoRedeem ? 'Yes' : 'No'}</td>
                <td>{withdraw.vault?.collateralToken?.symbol || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="profile-cards-mobile">
        {paginatedWithdraws.map((withdraw, index) => (
          <div key={index} className="profile-card">
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
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
