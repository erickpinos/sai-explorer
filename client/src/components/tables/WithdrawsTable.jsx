import { useWithdraws } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Pagination from '../ui/Pagination';
import { WITHDRAWS_PER_PAGE } from '../../utils/constants';
import { useViewToggle } from '../ui/ViewToggle';
import { usePagination } from '../../hooks/usePagination';

export default function WithdrawsTable() {
  const { network } = useNetwork();
  const { data: withdraws, loading, error } = useWithdraws(network);
  const { toggle, viewClass } = useViewToggle();

  const { page, setPage, paginatedData: paginatedWithdraws, totalPages, startIndex } = usePagination(withdraws || [], WITHDRAWS_PER_PAGE);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!withdraws || withdraws.length === 0) return <EmptyState message="No withdraws found" />;

  const endIndex = startIndex + WITHDRAWS_PER_PAGE;

  return (
    <div className={viewClass}>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, withdraws.length)} of {withdraws.length} withdraws
        {toggle}
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
