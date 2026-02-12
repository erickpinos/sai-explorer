import { useState } from 'react';
import { useDeposits } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { DEPOSITS_PER_PAGE } from '../../utils/constants';

export default function DepositsTable() {
  const { network } = useNetwork();
  const { data: deposits, loading, error } = useDeposits(network);
  const [currentPage, setCurrentPage] = useState(1);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!deposits || deposits.length === 0) return <EmptyState message="No deposits found" />;

  const startIndex = (currentPage - 1) * DEPOSITS_PER_PAGE;
  const endIndex = startIndex + DEPOSITS_PER_PAGE;
  const paginatedDeposits = deposits.slice(startIndex, endIndex);
  const totalPages = Math.ceil(deposits.length / DEPOSITS_PER_PAGE);

  return (
    <div>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, deposits.length)} of {deposits.length} deposits
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Depositor</th>
              <th>Amount</th>
              <th>Shares</th>
              <th>Vault</th>
              <th>TVL</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDeposits.map((deposit, index) => (
              <tr key={deposit.id || index}>
                <td>{formatDate(deposit.block?.block_ts)}</td>
                <td title={deposit.depositor}>
                  {formatAddress(deposit.depositor)}
                </td>
                <td>${formatNumber(deposit.amount)}</td>
                <td>{formatNumber(deposit.shares)}</td>
                <td>{deposit.vault?.collateralToken?.symbol || '-'}</td>
                <td>${formatNumber(deposit.vault?.tvl || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
