import { X } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

const Tag = ({ type }) => {
  const styles = {
    api:  { background: '#0f2744', color: '#60a5fa', border: '1px solid #1e4080' },
    calc: { background: '#1a1a0a', color: '#fbbf24', border: '1px solid #3d3000' },
    sync: { background: '#0f2744', color: '#60a5fa', border: '1px solid #1e4080' },
    est:  { background: '#111',    color: '#555',    border: '1px solid #333' },
  };
  return (
    <span style={{
      fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
      fontFamily: 'monospace', letterSpacing: '0.05em', marginLeft: '5px',
      verticalAlign: 'middle', whiteSpace: 'nowrap',
      ...(styles[type] || styles.calc),
    }}>
      {type === 'api' ? 'API' : type}
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
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
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
                <InfoRow label={`${sym} price (coingecko)`}
                  value={`$${formatNumber(p, 6)}`} tag="calc" />
              )}
            </div>
          </div>

          {/* Amounts */}
          <div className="trade-detail-section" style={{ marginBottom: '20px' }}>
            <h3 className="trade-detail-section-title">Amounts</h3>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left',   color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px' }}>Field</th>
                  <th style={{ textAlign: 'right',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '16px' }}>
                    Raw integer <Tag type="api" />
                  </th>
                  <th style={{ textAlign: 'right',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '16px' }}>
                    Tokens ({sym}) <Tag type="calc" />
                  </th>
                  <th style={{ textAlign: 'right',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: 0 }}>
                    USD VALUE (Now) <Tag type="calc" />
                  </th>
                </tr>
              </thead>
              <tbody style={{ lineHeight: '2' }}>
                <AmountRow label="tvl"            rawInt={vault.tvl}            sym={sym} collateralPrice={p} />
                <AmountRow label="availableAssets" rawInt={vault.availableAssets} sym={sym} collateralPrice={p} />
                <tr><td colSpan={4} style={{ borderTop: '1px solid #1e1e1e', padding: '3px 0' }} /></tr>
                <AmountRow label="RevenueCumulative"             rawInt={ri.RevenueCumulative}             sym={sym} collateralPrice={p} />
                <AmountRow label="NetProfit"                     rawInt={ri.NetProfit}                     sym={sym} collateralPrice={p} />
                <AmountRow label="TraderLosses"                  rawInt={ri.TraderLosses}                  sym={sym} collateralPrice={p} />
                <AmountRow label="ClosedPnl"                     rawInt={ri.ClosedPnl}                     sym={sym} collateralPrice={p} />
                <AmountRow label="CurrentEpochPositiveOpenPnl"   rawInt={ri.CurrentEpochPositiveOpenPnl}   sym={sym} collateralPrice={p} />
                <AmountRow label="Liabilities"                   rawInt={ri.Liabilities}                   sym={sym} collateralPrice={p} />
                <AmountRow label="Rewards"                       rawInt={ri.Rewards}                       sym={sym} collateralPrice={p} />
              </tbody>
            </table>
            </div>
          </div>

          {/* APY note — dev only */}
          {import.meta.env.DEV && <div className="trade-detail-section">
            <h3 className="trade-detail-section-title">APY by different periods</h3>
            <div className="trade-detail-rows">
              <div className="trade-detail-row">
                <span className="trade-detail-label">Formula</span>
                <span className="trade-detail-value" style={{ fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>
                  ((end_price / start_price)^(365 / days) − 1) × 100
                </span>
              </div>
            </div>

            {vault.apyWindows && Object.keys(vault.apyWindows).length > 0 && (
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left',  color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px' }}>Window</th>
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '12px' }}>Start price</th>
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '12px' }}>End price</th>
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '12px' }}>Ratio</th>
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px' }}>APY</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(vault.apyWindows).map(([window, w]) => {
                    const cls = w.apy >= 0 ? 'pnl-positive' : 'pnl-negative';
                    const ratio = w.endPrice / w.startPrice;
                    const dimStyle = w.partial ? { opacity: 0.5, fontStyle: 'italic' } : {};
                    return (
                      <tr key={window} style={{ borderBottom: '1px solid #111', ...dimStyle }}>
                        <td style={{ color: '#aaa', fontSize: '12px', padding: '5px 0' }}>
                          {window}
                          {w.partial && (
                            <span title={`Only ${Math.round(w.actualDays)}d of history available`}
                              style={{ fontSize: '9px', color: '#555', marginLeft: '5px', fontFamily: 'monospace' }}>
                              (~{Math.round(w.actualDays)}d)
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '12px', fontFamily: 'monospace', fontSize: '11px', color: w.startSource === 'est' ? '#555' : '#888', fontStyle: w.startSource === 'est' ? 'italic' : 'normal' }}
                            title={new Date(w.startTs).toLocaleString()}>
                          {formatNumber(w.startPrice, 6)} <Tag type={w.startSource || 'calc'} />
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '12px', fontFamily: 'monospace', fontSize: '11px', color: '#ccc' }}>
                          {formatNumber(w.endPrice, 6)} <Tag type="api" />
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '12px', fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                          {formatNumber(ratio, 6)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px' }} className={cls}>
                          {w.apy >= 0 ? '+' : ''}{formatNumber(w.apy, 2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>}

          {/* APY over time — dev only */}
          {import.meta.env.DEV && vault.sharePriceHistory && vault.sharePriceHistory.length > 0 && (() => {
            // Use backend daily history + live "now" point
            const history = [
              ...vault.sharePriceHistory,
              { ts: new Date().toISOString(), sharePrice: vault.sharePrice, source: 'api' },
            ];
            const rows = history.map((point, i) => {
              const pointTs = new Date(point.ts).getTime();
              const target = pointTs - 30 * 24 * 60 * 60 * 1000;
              const candidates = history.slice(0, i);
              if (candidates.length === 0) return null;
              const start = candidates.reduce((best, p) =>
                Math.abs(new Date(p.ts).getTime() - target) < Math.abs(new Date(best.ts).getTime() - target) ? p : best
              );
              const ratio = point.sharePrice / start.sharePrice;
              const apy = (Math.pow(ratio, 365 / 30) - 1) * 100;
              return {
                ts: point.ts, apy, endSource: point.source,
                txHash: point.txHash, evmTxHash: point.evmTxHash,
                startPrice: start.sharePrice, startTs: start.ts, startSource: start.source,
                startTxHash: start.txHash, startEvmTxHash: start.evmTxHash,
                endPrice: point.sharePrice, ratio,
              };
            }).filter(Boolean).reverse();

            if (rows.length === 0) return null;

            const srcTag = (source) => {
              const colors = { calc: '#fbbf24', sync: '#60a5fa', est: '#555', api: '#fff' };
              return (
                <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace',
                  background: '#111', color: colors[source] || '#555', border: `1px solid ${colors[source] || '#333'}`,
                  marginLeft: '4px', verticalAlign: 'middle' }}>
                  {source}
                </span>
              );
            };

            const priceCell = (price, source) => {
              const isEst = source === 'est';
              return (
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', padding: '4px 12px 4px 0', whiteSpace: 'nowrap',
                  color: isEst ? '#555' : '#ccc', fontStyle: isEst ? 'italic' : 'normal' }}>
                  {formatNumber(price, 6)}
                  {srcTag(source)}
                </td>
              );
            };

            return (
              <div className="trade-detail-section" style={{ marginTop: '20px' }}>
                <h3 className="trade-detail-section-title">APY over time (30d)</h3>
                <div className="trade-detail-rows" style={{ marginBottom: '12px' }}>
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Formula</span>
                    <span className="trade-detail-value" style={{ fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>
                      ((end_price / start_price)^(365 / 30) − 1) × 100
                    </span>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                      {['Date', 'Start Date', 'End Price', 'Start Price', 'Ratio', 'APY'].map((h, i) => (
                        <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: i < 5 ? '12px' : 0 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const cls = r.apy >= 0 ? 'pnl-positive' : 'pnl-negative';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                          <td style={{ fontSize: '11px', padding: '4px 12px 4px 0', fontFamily: 'monospace', whiteSpace: 'nowrap', color: '#888' }}>
                            {new Date(r.ts).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: '12px', fontFamily: 'monospace', fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>
                            {new Date(r.startTs).toLocaleDateString()}
                          </td>
                          {priceCell(r.endPrice, r.endSource)}
                          {priceCell(r.startPrice, r.startSource)}
                          <td style={{ textAlign: 'right', paddingRight: '12px', fontFamily: 'monospace', fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>
                            {formatNumber(r.ratio, 6)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, padding: '4px 0', whiteSpace: 'nowrap' }} className={cls}>
                            {r.apy >= 0 ? '+' : ''}{formatNumber(r.apy, 2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            );
          })()}

          {/* Share price history — dev only */}
          {import.meta.env.DEV && vault.sharePriceHistory && vault.sharePriceHistory.length > 0 && (
            <div className="trade-detail-section" style={{ marginTop: '20px' }}>
              <h3 className="trade-detail-section-title">Share Price History</h3>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px', paddingRight: '16px' }}>Timestamp</th>
                    <th style={{ textAlign: 'left', color: '#555', fontWeight: 400, fontSize: '11px', paddingBottom: '6px' }}>Share Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { ts: new Date().toISOString(), sharePrice: vault.sharePrice, source: 'api' },
                    ...[...vault.sharePriceHistory].reverse()
                  ].map((p, i) => {
                    const isEst = p.source === 'est';
                    const srcColors = { calc: '#fbbf24', sync: '#60a5fa', est: '#444', api: '#fff' };
                    const tagColor = srcColors[p.source] || '#888';
                    const textColor = isEst ? '#888' : '#fff';
                    const tag = (
                      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace',
                        background: '#111', color: tagColor, border: `1px solid ${tagColor}`, marginLeft: '5px', verticalAlign: 'middle' }}>
                        {p.source}
                      </span>
                    );
                    const timestamp = new Date(p.ts).toLocaleString();
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #111', fontStyle: isEst ? 'italic' : 'normal' }}>
                        <td style={{ color: textColor, fontSize: '12px', padding: '4px 16px 4px 0', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {timestamp}{tag}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: textColor, padding: '4px 0', whiteSpace: 'nowrap' }}>
                          {formatNumber(p.sharePrice, 6)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div style={{ marginTop: '12px', fontSize: '11px', color: '#555', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '4px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>How share prices are sourced</div>
                <div><span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '9px', border: '1px solid #fff', background: '#111', padding: '1px 4px', borderRadius: '3px', marginRight: '6px' }}>api</span>Live share price from the GraphQL API — current value only.</div>
                <div style={{ marginTop: '4px' }}><span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: '9px', border: '1px solid #3d3000', background: '#1a1a0a', padding: '1px 4px', borderRadius: '3px', marginRight: '6px' }}>calc</span>Calculated from on-chain deposit events: <span style={{ fontFamily: 'monospace' }}>amount / shares</span> at the time of the transaction.</div>
                <div style={{ marginTop: '4px' }}><span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: '9px', border: '1px solid #1e4080', background: '#0f2744', padding: '1px 4px', borderRadius: '3px', marginRight: '6px' }}>sync</span>Daily snapshot recorded by the sync cron at 8pm EDT (00:00 UTC).</div>
                <div style={{ marginTop: '4px' }}><span style={{ color: '#555', fontFamily: 'monospace', fontSize: '9px', border: '1px solid #333', background: '#111', padding: '1px 4px', borderRadius: '3px', marginRight: '6px' }}>est</span>Estimated — no known data point for this day, so the last known price is carried forward.</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
