import { formatNumber } from '../../utils/formatters';

const Tag = ({ type }) => {
  const styles = {
    api:  { background: '#0f2744', color: '#60a5fa', border: '1px solid #1e4080' },
    calc: { background: '#1a1a0a', color: '#fbbf24', border: '1px solid #3d3000' },
  };
  return (
    <span style={{
      fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
      fontFamily: 'monospace', letterSpacing: '0.05em', marginLeft: '5px',
      verticalAlign: 'middle', whiteSpace: 'nowrap',
      ...styles[type],
    }}>
      {type === 'api' ? 'API' : 'calc'}
    </span>
  );
};

function InfoRow({ label, value, tag, mono, dim }) {
  return (
    <div className="trade-detail-row">
      <span className="trade-detail-label">
        {label}<Tag type={tag} />
      </span>
      <span className="trade-detail-value trade-detail-mono"
        style={{ fontSize: mono ? '11px' : undefined, color: dim ? '#888' : undefined, wordBreak: 'break-all', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function AmountRow({ label, rawInt, sym, collateralPrice, historicalPrice }) {
  const tokens = (rawInt || 0) / 1e6;
  const usd = tokens * collateralPrice;
  const usdCls = usd < 0 ? 'pnl-negative' : '';
  const histUsd = historicalPrice != null ? tokens * historicalPrice : null;
  const histCls = histUsd != null && histUsd < 0 ? 'pnl-negative' : '';

  return (
    <tr>
      <td style={{ color: '#aaa', paddingRight: '12px', whiteSpace: 'nowrap', verticalAlign: 'middle', fontSize: '13px' }}>
        {label}
      </td>
      {/* Raw integer — directly from API */}
      <td style={{ textAlign: 'right', paddingRight: '16px', fontFamily: 'monospace', fontSize: '11px', color: '#555', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        {(rawInt || 0).toLocaleString()}
      </td>
      {/* Tokens — calc: raw / 1e6 */}
      <td style={{ textAlign: 'right', paddingRight: '16px', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        {formatNumber(tokens, 2)} {sym}
      </td>
      {/* USD current — calc: tokens × price */}
      <td style={{ textAlign: 'right', paddingRight: historicalPrice != null ? '16px' : 0, fontWeight: 600, verticalAlign: 'middle', whiteSpace: 'nowrap' }} className={usdCls}>
        ${formatNumber(usd, 2)}
      </td>
      {/* USD at epoch start — calc: tokens × historicalPrice */}
      {historicalPrice != null && (
        <td style={{ textAlign: 'right', fontWeight: 600, verticalAlign: 'middle', whiteSpace: 'nowrap' }} className={histCls}>
          ${formatNumber(histUsd, 2)}
        </td>
      )}
    </tr>
  );
}

export default function VaultDetailModal({ vault, onClose }) {
  if (!vault) return null;

  const sym = vault.collateralToken?.symbol || '-';
  const p = vault.collateralPrice || 1;
  const isStable = sym === 'USDC' || sym === 'USDT';
  const ri = vault.revenueInfo || {};

  // APY is a percentage directly from the API (e.g. -83.85)
  const apy = vault.apy ?? null;
  const apyDisplay = apy != null ? `${apy >= 0 ? '+' : ''}${formatNumber(apy, 4)}%` : '-';
  const apyCls = apy != null && apy >= 0 ? 'pnl-positive' : 'pnl-negative';

  // epochStart is nanoseconds → convert to ms for JS Date
  const epochStartMs = vault.epochStart ? vault.epochStart / 1e6 : null;
  const epochStartDate = epochStartMs ? new Date(epochStartMs).toLocaleString() : '-';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal trade-detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2>Vault Details</h2>
            <span className="badge badge-purple">{sym}</span>
            <span className={apyCls} style={{ fontWeight: 600 }}>APY: {apyDisplay}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content" style={{ padding: '24px', overflowY: 'auto' }}>

          {/* Identity */}
          <div className="trade-detail-section" style={{ marginBottom: '20px' }}>
            <h3 className="trade-detail-section-title">Identity</h3>
            <div className="trade-detail-rows">
              <InfoRow label="address"        value={vault.address}                     tag="api" mono />
              <InfoRow label="collateralDenom" value={vault.collateralDenom || '-'}      tag="api" mono dim />
              <InfoRow label="collateralToken.symbol" value={vault.collateralToken?.symbol || '-'} tag="api" />
              <InfoRow label="collateralToken.name"   value={vault.collateralToken?.name || '-'}   tag="api" dim />
              <InfoRow label="collateralERC20" value={vault.collateralERC20 || '-'}      tag="api" mono dim />
              <InfoRow label="sharesDenom"    value={vault.sharesDenom || '-'}           tag="api" mono dim />
              <InfoRow label="sharesERC20"    value={vault.sharesERC20 || '-'}           tag="api" mono />
            </div>
          </div>

          {/* Performance */}
          <div className="trade-detail-section" style={{ marginBottom: '20px' }}>
            <h3 className="trade-detail-section-title">Performance</h3>
            <div className="trade-detail-rows">
              <InfoRow label="sharePrice" tag="api"
                value={`${formatNumber(vault.sharePrice || 0, 6)} ${sym}`} />
              <InfoRow label="apy" tag="api"
                value={<span className={apyCls}>{apyDisplay}</span>} />
              <InfoRow label="currentEpoch"  value={vault.currentEpoch ?? '-'}          tag="api" />
              <InfoRow label="epochStart"    value={`${epochStartDate}`}                tag="api" />
              <InfoRow label="epochStart (raw ns)" value={(vault.epochStart || 0).toLocaleString()} tag="api" mono dim />
              <InfoRow label="epochDurationDays"  value={vault.epochDurationDays ?? '-'} tag="api" />
              <InfoRow label="epochDurationHours" value={vault.epochDurationHours ?? '-'} tag="api" />
              {!isStable && (
                <InfoRow label={`${sym} price (oracle)`}
                  value={`$${formatNumber(p, 6)}`} tag="calc" />
              )}
              {!isStable && vault.historicalPrice != null && (
                <InfoRow label={`${sym} price @ epoch start`}
                  value={`$${formatNumber(vault.historicalPrice, 6)}`} tag="calc" />
              )}
            </div>
          </div>

          {/* Amounts */}
          <div className="trade-detail-section" style={{ marginBottom: '20px' }}>
            <h3 className="trade-detail-section-title">Amounts</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left',   color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px' }}>Field</th>
                  <th style={{ textAlign: 'right',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '16px' }}>
                    Raw integer <Tag type="api" />
                  </th>
                  <th style={{ textAlign: 'right',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '16px' }}>
                    Tokens ({sym}) <Tag type="calc" />
                  </th>
                  <th style={{ textAlign: 'right',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: vault.historicalPrice != null ? '16px' : 0 }}>
                    USD (now) <Tag type="calc" />
                  </th>
                  {vault.historicalPrice != null && (
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px' }}>
                      USD @ epoch start <Tag type="calc" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody style={{ lineHeight: '2' }}>
                <AmountRow label="tvl"            rawInt={vault.tvl}            sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="availableAssets" rawInt={vault.availableAssets} sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <tr><td colSpan={vault.historicalPrice != null ? 5 : 4} style={{ borderTop: '1px solid #1e1e1e', padding: '3px 0' }} /></tr>
                <AmountRow label="RevenueCumulative"             rawInt={ri.RevenueCumulative}             sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="NetProfit"                     rawInt={ri.NetProfit}                     sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="TraderLosses"                  rawInt={ri.TraderLosses}                  sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="ClosedPnl"                     rawInt={ri.ClosedPnl}                     sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="CurrentEpochPositiveOpenPnl"   rawInt={ri.CurrentEpochPositiveOpenPnl}   sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="Liabilities"                   rawInt={ri.Liabilities}                   sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
                <AmountRow label="Rewards"                       rawInt={ri.Rewards}                       sym={sym} collateralPrice={p} historicalPrice={vault.historicalPrice} />
              </tbody>
            </table>
          </div>

          {/* APY note */}
          <div className="trade-detail-section">
            <h3 className="trade-detail-section-title">APY Note</h3>
            <div className="trade-detail-rows">
              <div className="trade-detail-row">
                <span className="trade-detail-label">apy (API) <Tag type="api" /></span>
                <span className={`trade-detail-value ${apyCls}`} style={{ fontWeight: 700, fontSize: '16px' }}>{apyDisplay}</span>
              </div>
              <div className="trade-detail-row">
                <span className="trade-detail-label">Simplified formula <Tag type="calc" /></span>
                <span className="trade-detail-value" style={{ fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>
                  (NetProfit / tvl) × (365 / epochDurationDays)
                </span>
              </div>
              <div className="trade-detail-row">
                <span className="trade-detail-label">Formula inputs <Tag type="calc" /></span>
                <span className="trade-detail-value" style={{ fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>
                  {apy != null && vault.tvl
                    ? `(${formatNumber(ri.NetProfit / vault.tvl, 6)}) × (365 / ${vault.epochDurationDays || 3})`
                    : '-'}
                </span>
              </div>
              <div className="trade-detail-row">
                <span className="trade-detail-label">Formula result <Tag type="calc" /></span>
                <span className="trade-detail-value" style={{ fontSize: '12px', color: '#aaa' }}>
                  {apy != null && vault.tvl
                    ? `${formatNumber((ri.NetProfit / vault.tvl) * (365 / (vault.epochDurationDays || 3)), 2)}%`
                    : '-'}
                </span>
              </div>
              <div className="trade-detail-row" style={{ marginTop: '4px' }}>
                <span className="trade-detail-label" />
                <span className="trade-detail-value" style={{ fontSize: '11px', color: '#666', maxWidth: '400px', textAlign: 'right' }}>
                  The API computes APY server-side using internal epoch snapshots. The simplified formula is an approximation only.
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
