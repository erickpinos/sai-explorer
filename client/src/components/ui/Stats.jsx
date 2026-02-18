import { useState } from 'react';
import { useStats, useTvlBreakdown } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatUSD } from '../../utils/formatters';

function truncateAddress(addr) {
  if (!addr) return '—';
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

function TvlBreakdownModal({ network, onClose }) {
  const { data, loading } = useTvlBreakdown(network);
  const vaults = data?.vaults || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>TVL Breakdown by Vault</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="modal-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>SLP TOKEN ADDRESS</th>
                  <th>TOKEN</th>
                  <th style={{ textAlign: 'right' }}>TOKENS</th>
                  <th style={{ textAlign: 'right' }}>TVL (USD)</th>
                </tr>
              </thead>
              <tbody>
                {vaults.map((vault, i) => (
                  <tr key={vault.address}>
                    <td>{i + 1}</td>
                    <td>
                      <span className="mono">{truncateAddress(vault.address)}</span>
                      {vault.deprecated && <span className="deprecated-tag"> (deprecated)</span>}
                    </td>
                    <td>{vault.token}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(vault.tokens, 2)}</td>
                    <td style={{ textAlign: 'right' }}>{formatUSD(vault.tvl)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}><strong>Total (Active)</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{formatUSD(data?.totalActiveTvl || 0)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function VolumeMethodologyModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Volume Methodology</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="methodology-content">
          <div className="methodology-section">
            <h3>How Trading Volume is Calculated</h3>
            <p>
              Trading volume represents the total <strong>notional value</strong> of all perpetual trades executed on the platform.
            </p>
          </div>

          <div className="methodology-section">
            <h3>Formula</h3>
            <div className="methodology-formula">
              Volume = Collateral Amount &times; Leverage
            </div>
            <p>
              Each trade's notional size is calculated by multiplying the collateral deposited by the leverage used.
              For example, a $100 collateral position at 10x leverage = $1,000 notional volume.
            </p>
          </div>

          <div className="methodology-section">
            <h3>What's Counted</h3>
            <ul>
              <li><strong>Position Opens</strong> &mdash; When a new market order position is opened</li>
              <li><strong>Triggered Orders</strong> &mdash; When a limit order executes and becomes a position</li>
            </ul>
          </div>

          <div className="methodology-section">
            <h3>What's Excluded</h3>
            <ul>
              <li><strong>Closes &amp; Liquidations</strong> &mdash; Settling an existing position, not new volume</li>
              <li><strong>TP/SL Updates</strong> &mdash; Parameter changes, no capital deployed</li>
              <li><strong>Pending Orders</strong> &mdash; Limit orders not yet triggered</li>
            </ul>
            <p className="methodology-note">
              Each position is counted once — when it is opened. Counting closes would double-count
              every position since the same notional appears in both the open and close records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const { network } = useNetwork();
  const { data: stats, loading } = useStats(network);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showTvl, setShowTvl] = useState(false);

  if (loading) {
    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            Total Volume
            <button
              className="methodology-link"
              onClick={() => setShowMethodology(true)}
              title="How is this calculated?"
            >
              &#x24D8;
            </button>
          </div>
          <div className="stat-value">{formatUSD(stats?.trades?.volume || 0)}</div>
        </div>
        <div className="stat-card clickable" onClick={() => setShowTvl(true)} title="View breakdown by vault">
          <div className="stat-label">
            Total TVL
            <span className="methodology-link">&#x24D8;</span>
          </div>
          <div className="stat-value">{formatUSD(stats?.tvl || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Perpetual Trades</div>
          <div className="stat-value">{formatNumber(stats?.trades?.total || 0, 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">LP Deposits</div>
          <div className="stat-value">{formatNumber(stats?.deposits?.total || 0, 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Withdraw Requests</div>
          <div className="stat-value">{formatNumber(stats?.withdraws?.total || 0, 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Traders</div>
          <div className="stat-value">{formatNumber(stats?.traders?.unique || 0, 0)}</div>
        </div>
      </div>

      {showMethodology && (
        <VolumeMethodologyModal onClose={() => setShowMethodology(false)} />
      )}
      {showTvl && (
        <TvlBreakdownModal network={network} onClose={() => setShowTvl(false)} />
      )}
    </>
  );
}
