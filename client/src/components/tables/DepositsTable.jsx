import { useState } from 'react';
import { useDeposits } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatAddress } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import UserProfileModal from '../modals/UserProfileModal';
import { DEPOSITS_PER_PAGE } from '../../utils/constants';
import { useViewToggle } from '../ui/ViewToggle';

// Bech32 decoding to convert nibi addresses to 0x
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Decode(str) {
  const data = [];
  for (let i = str.indexOf('1') + 1; i < str.length - 6; i++) {
    data.push(CHARSET.indexOf(str[i]));
  }
  let acc = 0, bits = 0;
  const bytes = [];
  for (const val of data) {
    acc = (acc << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes;
}

function nibiToHex(nibiAddr) {
  if (!nibiAddr) return null;
  try {
    const bytes = bech32Decode(nibiAddr);
    return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return nibiAddr;
  }
}

export default function DepositsTable() {
  const { network } = useNetwork();
  const { data: deposits, loading, error } = useDeposits(network);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserAddress, setSelectedUserAddress] = useState(null);
  const { toggle, viewClass } = useViewToggle();

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!deposits || deposits.length === 0) return <EmptyState message="No deposits found" />;

  const startIndex = (currentPage - 1) * DEPOSITS_PER_PAGE;
  const endIndex = startIndex + DEPOSITS_PER_PAGE;
  const paginatedDeposits = deposits.slice(startIndex, endIndex);
  const totalPages = Math.ceil(deposits.length / DEPOSITS_PER_PAGE);

  return (
    <div className={viewClass}>
      <div className="table-info">
        Showing {startIndex + 1}-{Math.min(endIndex, deposits.length)} of {deposits.length} deposits
        {toggle}
      </div>

      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <th>TIME</th>
              <th>ACTION</th>
              <th>DEPOSITOR</th>
              <th>AMOUNT</th>
              <th>TOKEN</th>
              <th>SHARES</th>
              <th>BLOCK</th>
              <th>VAULT (NIBI)</th>
              <th>VAULT SHARES (HARDCODED)</th>
              <th>TX HASH</th>
              <th>EVM TX HASH</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDeposits.map((deposit, index) => (
              <tr key={deposit.id || index}>
                <td>{formatDate(deposit.block?.block_ts)}</td>
                <td>
                  <span className="badge badge-green">Deposit</span>
                </td>
                <td>
                  <span
                    className="address-link"
                    onClick={() => setSelectedUserAddress({
                      bech32: deposit.depositor,
                      evm: nibiToHex(deposit.depositor)
                    })}
                    style={{ cursor: 'pointer' }}
                    title={deposit.depositor}
                  >
                    {formatAddress(deposit.depositor)}
                  </span>
                </td>
                <td>${formatNumber(deposit.amount / 1000000, 2)}</td>
                <td>{deposit.vault?.collateralToken?.symbol || '-'}</td>
                <td>{formatNumber(deposit.shares / 1000000, 2)}</td>
                <td>{deposit.block?.block || '-'}</td>
                <td>
                  <span className="address-link" title={deposit.vault?.address}>
                    {formatAddress(deposit.vault?.address)}
                  </span>
                </td>
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
                  ) : (
                    '-'
                  )}
                </td>
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
                  ) : (
                    '-'
                  )}
                </td>
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
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="profile-cards-mobile">
        {paginatedDeposits.map((deposit, index) => (
          <div key={deposit.id || index} className="profile-card">
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
                  onClick={() => setSelectedUserAddress({ bech32: deposit.depositor, evm: nibiToHex(deposit.depositor) })}
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

      {selectedUserAddress && (
        <UserProfileModal
          address={selectedUserAddress}
          onClose={() => setSelectedUserAddress(null)}
        />
      )}
    </div>
  );
}
