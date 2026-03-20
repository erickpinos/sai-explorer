import { useLpVaults } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber } from '../../utils/formatters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { useViewToggle } from '../ui/ViewToggle';
import { useSortedData } from '../../hooks/useSortedData';
import SortTh from '../ui/SortTh';
import SortDropdown from '../ui/SortDropdown';
import { useNavigate, useLocation } from 'react-router-dom';

const SORT_OPTIONS = [
  { key: 'tvl', label: 'TVL' },
  { key: 'apy', label: 'APY' },
  { key: 'netProfit', label: 'Net Profit' },
  { key: 'liabilities', label: 'Liabilities' },
  { key: 'availableAssets', label: 'Available' },
];

const SORT_KEYS = {
  tvl:             (v) => v.tvlUsd || 0,
  apy:             (v) => v.apy ?? 0,
  netProfit:       (v) => v.netProfitUsd || 0,
  liabilities:     (v) => v.liabilitiesUsd || 0,
  availableAssets: (v) => v.availableUsd || 0,
};

function toUsd(microAmount, collateralPrice = 1) {
  return (microAmount || 0) / 1e6 * collateralPrice;
}

function shortAddress(addr) {
  if (!addr) return '-';
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function LpVaultsTable() {
  const { network } = useNetwork();
  const { data, loading, error } = useLpVaults(network);
  const { toggle, viewClass } = useViewToggle('lp-vaults');
  const navigate = useNavigate();
  const location = useLocation();

  const openVault = (v) => navigate(`/vault/${encodeURIComponent(v.address)}`, {
    state: { background: location, vault: v },
  });

  const epochDurationDays = data?.epochDurationDays ?? '-';

  const vaults = (data?.vaults || []).map(v => {
    const p = v.collateralPrice || 1;
    return {
      ...v,
      epochDurationDays: data?.epochDurationDays,
      tvlUsd:           toUsd(v.tvl, p),
      availableUsd:     toUsd(v.availableAssets, p),
      netProfitUsd:     toUsd(v.revenueInfo?.NetProfit, p),
      liabilitiesUsd:   toUsd(v.revenueInfo?.Liabilities, p),
      revCumulativeUsd: toUsd(v.revenueInfo?.RevenueCumulative, p),
      traderLossesUsd:  toUsd(v.revenueInfo?.TraderLosses, p),
      closedPnlUsd:     toUsd(v.revenueInfo?.ClosedPnl, p),
      openPnlUsd:       toUsd(v.revenueInfo?.CurrentEpochPositiveOpenPnl, p),
      rewardsUsd:       toUsd(v.revenueInfo?.Rewards, p),
    };
  });

  const { sorted, sortCol, sortDir, handleSort } = useSortedData(vaults, 'tvl', 'desc', SORT_KEYS);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState message={`Error: ${error}`} />;
  if (!sorted.length) return <EmptyState message="No vaults found" />;

  const Th = ({ col, children }) => (
    <SortTh col={col} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{children}</SortTh>
  );

  const symbol = (v) => v.collateralToken?.symbol || '-';

  return (
    <div className={viewClass}>
      <div className="table-info">{sorted.length} vaults{toggle}</div>

      <div className="table-wrapper profile-table-desktop">
        <table>
          <thead>
            <tr>
              <th>Vault</th>
              <th>Collateral</th>
              <Th col="tvl">TVL</Th>
              <th>Share Price</th>
              <Th col="apy">APY</Th>
              <Th col="availableAssets">Available</Th>
              <Th col="netProfit">Net Profit</Th>
              <Th col="liabilities">Liabilities</Th>
              <th>Revenue (cumul.)</th>
              <th>Trader Losses</th>
              <th>Open PnL (epoch)</th>
              <th>Epoch</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, i) => {
              const apyPct = v.apy != null ? formatNumber(v.apy, 2) : null;
              const apyCls = v.apy >= 0 ? 'pnl-positive' : 'pnl-negative';
              const netCls = v.netProfitUsd >= 0 ? 'pnl-positive' : 'pnl-negative';
              const sym = symbol(v);
              return (
                <tr key={i}>
                  <td>
                    <button
                      className="tx-hash"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace' }}
                      onClick={() => openVault(v)}
                      title={v.address}
                    >
                      {shortAddress(v.address)}
                    </button>
                  </td>
                  <td><strong>{sym}</strong></td>
                  <td>${formatNumber(v.tvlUsd, 2)}</td>
                  <td>{formatNumber(v.sharePrice || 0, 6)}</td>
                  <td className={apyCls}>
                    {apyPct != null ? `${v.apy >= 0 ? '+' : ''}${apyPct}%` : '-'}
                  </td>
                  <td>${formatNumber(v.availableUsd, 2)}</td>
                  <td className={netCls}>${formatNumber(v.netProfitUsd, 2)}</td>
                  <td className="pnl-negative">${formatNumber(v.liabilitiesUsd, 2)}</td>
                  <td>${formatNumber(v.revCumulativeUsd, 2)}</td>
                  <td>${formatNumber(v.traderLossesUsd, 2)}</td>
                  <td>${formatNumber(v.openPnlUsd, 2)}</td>
                  <td>{v.currentEpoch ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SortDropdown options={SORT_OPTIONS} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />

      <div className="profile-cards-mobile">
        {sorted.map((v, i) => {
          const apyPct = v.apy != null ? formatNumber(v.apy, 2) : null;
          const apyCls = v.apy >= 0 ? 'pnl-positive' : 'pnl-negative';
          const netCls = v.netProfitUsd >= 0 ? 'pnl-positive' : 'pnl-negative';
          const sym = symbol(v);
          return (
            <div key={i} className="profile-card" style={{ cursor: 'pointer' }} onClick={() => openVault(v)}>
              <div className="profile-card-header">
                <div className="profile-card-badges">
                  <span className="profile-card-market">{sym}</span>
                  <code style={{ fontSize: '11px', color: '#888' }}>{shortAddress(v.address)}</code>
                </div>
                {apyPct != null && (
                  <span className={apyCls}>{v.apy >= 0 ? '+' : ''}{apyPct}% APY</span>
                )}
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">TVL</span>
                <span className="profile-card-value">${formatNumber(v.tvlUsd, 2)}</span>
                <span className="profile-card-label">Available</span>
                <span className="profile-card-value">${formatNumber(v.availableUsd, 2)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Net Profit</span>
                <span className={`profile-card-value ${netCls}`}>${formatNumber(v.netProfitUsd, 2)}</span>
                <span className="profile-card-label">Liabilities</span>
                <span className="profile-card-value pnl-negative">${formatNumber(v.liabilitiesUsd, 2)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Revenue</span>
                <span className="profile-card-value">${formatNumber(v.revCumulativeUsd, 2)}</span>
                <span className="profile-card-label">Trader Losses</span>
                <span className="profile-card-value">${formatNumber(v.traderLossesUsd, 2)}</span>
              </div>
              <div className="profile-card-row">
                <span className="profile-card-label">Open PnL</span>
                <span className="profile-card-value">${formatNumber(v.openPnlUsd, 2)}</span>
                <span className="profile-card-label">Epoch</span>
                <span className="profile-card-value">{v.currentEpoch ?? '-'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="markets-note">
        <span className="markets-note-icon">ℹ</span>
        <span>
          APY = ((share_price_now / share_price_30d_ago)^(365/30) − 1) × 100.
          A negative APY means the vault share price has declined over the last 30 days.
        </span>
      </div>

    </div>
  );
}
