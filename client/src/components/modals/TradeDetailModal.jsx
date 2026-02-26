import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatPrice } from '../../utils/formatters';

const shortenHash = (hash) => {
  if (!hash) return '-';
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
};

const toUsd = (microAmount, collateralPrice) => {
  const raw = (parseFloat(microAmount) || 0) / 1000000;
  const price = parseFloat(collateralPrice) || 1;
  return raw * price;
};

const getTradeTypeLabel = (type) => {
  if (!type) return 'Unknown';
  const s = type.toLowerCase();
  if (s.includes('liquidat')) return 'Liquidated';
  if (s.includes('opened')) return 'Opened';
  if (s.includes('cancel')) return 'Limit Order Cancelled';
  if (s.includes('closed')) return 'Closed';
  if (s.includes('trigger')) return 'Triggered';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const getTradeTypeBadgeClass = (type) => {
  if (!type) return 'badge badge-purple';
  const s = type.toLowerCase();
  if (s.includes('liquidat')) return 'badge badge-red';
  if (s.includes('opened')) return 'badge badge-blue';
  if (s.includes('cancel')) return 'badge badge-orange';
  if (s.includes('closed')) return 'badge badge-purple';
  if (s.includes('trigger')) return 'badge badge-yellow';
  return 'badge badge-purple';
};

export default function TradeDetailModal({ trade, onClose }) {
  const { config } = useNetwork();

  if (!trade) return null;

  const t = trade.trade || {};
  const pb = t.perpBorrowing || {};
  const collPrice = parseFloat(trade.collateralPrice) || 1;
  const collSymbol = pb.collateralToken?.symbol || 'USDC';
  const isStablecoin = ['USDC', 'USDT'].includes(collSymbol.toUpperCase());
  const marketSymbol = pb.baseToken?.symbol || '-';

  const rawCollateral = (parseFloat(t.collateralAmount) || 0) / 1000000;
  const collateralUsd = rawCollateral * collPrice;

  const rawOpenCollateral = (parseFloat(t.openCollateralAmount) || 0) / 1000000;
  const openCollateralUsd = rawOpenCollateral * collPrice;

  const rawPnl = (parseFloat(trade.realizedPnlCollateral) || 0) / 1000000;
  const pnlUsd = rawPnl * collPrice;
  const pnlPct = parseFloat(trade.realizedPnlPct) || 0;

  const displayType = (
    t.tradeType === 'limit' &&
    trade.tradeChangeType?.toLowerCase().includes('closed') &&
    !parseFloat(t.closePrice) &&
    !parseFloat(trade.realizedPnlCollateral)
  ) ? 'limit_order_cancelled' : trade.tradeChangeType;

  const hasTp = parseFloat(t.tp) > 0;
  const hasSl = parseFloat(t.sl) > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal trade-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2>Trade Details</h2>
            <span className={getTradeTypeBadgeClass(displayType)}>
              {getTradeTypeLabel(displayType)}
            </span>
            <span className={t.isLong ? 'badge badge-green' : 'badge badge-red'}>
              {t.isLong ? 'Long' : 'Short'}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content" style={{ padding: '24px', overflowY: 'auto' }}>
          <div className="trade-detail-grid">
            <div className="trade-detail-section">
              <h3 className="trade-detail-section-title">Position Info</h3>
              <div className="trade-detail-rows">
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Market</span>
                  <span className="trade-detail-value"><strong>{marketSymbol}</strong></span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Market ID</span>
                  <span className="trade-detail-value">{pb.marketId != null ? pb.marketId : '-'}</span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Collateral Type</span>
                  <span className="trade-detail-value">
                    <span className="badge badge-purple" style={{ fontSize: '11px' }}>{collSymbol}</span>
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Direction</span>
                  <span className="trade-detail-value">
                    <span className={t.isLong ? 'badge badge-green' : 'badge badge-red'}>
                      {t.isLong ? 'Long' : 'Short'}
                    </span>
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Leverage</span>
                  <span className="trade-detail-value">{formatNumber(t.leverage, 1)}x</span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Order Type</span>
                  <span className="trade-detail-value" style={{ textTransform: 'capitalize' }}>{t.tradeType || '-'}</span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Status</span>
                  <span className="trade-detail-value">{t.isOpen ? 'Open' : 'Closed'}</span>
                </div>
              </div>
            </div>

            <div className="trade-detail-section">
              <h3 className="trade-detail-section-title">Pricing</h3>
              <div className="trade-detail-rows">
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Open Price</span>
                  <span className="trade-detail-value">{formatPrice(t.openPrice || 0)}</span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Close Price</span>
                  <span className="trade-detail-value">
                    {parseFloat(t.closePrice) > 0 ? formatPrice(t.closePrice) : '-'}
                  </span>
                </div>
                {hasTp && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Take Profit</span>
                    <span className="trade-detail-value">{formatPrice(t.tp)}</span>
                  </div>
                )}
                {hasSl && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Stop Loss</span>
                    <span className="trade-detail-value">{formatPrice(t.sl)}</span>
                  </div>
                )}
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Time</span>
                  <span className="trade-detail-value">{formatDate(trade.block?.block_ts)}</span>
                </div>
              </div>
            </div>

            <div className="trade-detail-section">
              <h3 className="trade-detail-section-title">Collateral</h3>
              <div className="trade-detail-rows">
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Current Collateral</span>
                  <span className="trade-detail-value"><strong>${formatNumber(collateralUsd, 2)}</strong></span>
                </div>
                {openCollateralUsd > 0 && openCollateralUsd !== collateralUsd && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Opening Collateral</span>
                    <span className="trade-detail-value">${formatNumber(openCollateralUsd, 2)}</span>
                  </div>
                )}
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Position Size</span>
                  <span className="trade-detail-value">${formatNumber(collateralUsd * (parseFloat(t.leverage) || 1), 2)}</span>
                </div>
              </div>
            </div>

            {(pnlUsd !== 0 || pnlPct !== 0) && (
              <div className="trade-detail-section">
                <h3 className="trade-detail-section-title">Profit & Loss</h3>
                <div className="trade-detail-rows">
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Realized PnL</span>
                    <span className={`trade-detail-value ${pnlUsd > 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                      <strong>{pnlUsd > 0 ? '+' : ''}${formatNumber(pnlUsd, 2)}</strong>
                    </span>
                  </div>
                  {pnlPct !== 0 && (
                    <div className="trade-detail-row">
                      <span className="trade-detail-label">PnL %</span>
                      <span className={`trade-detail-value ${pnlPct > 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                        {pnlPct > 0 ? '+' : ''}{formatNumber(pnlPct, 2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="trade-detail-section">
              <h3 className="trade-detail-section-title">Addresses</h3>
              <div className="trade-detail-rows">
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Trader (Bech32)</span>
                  <span className="trade-detail-value trade-detail-mono">
                    <a href={`https://nibiru.explorers.guru/account/${t.trader}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {t.trader || '-'}
                    </a>
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Trader (EVM)</span>
                  <span className="trade-detail-value trade-detail-mono">
                    <a href={`https://nibiscan.io/address/${t.evmTrader}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {t.evmTrader || '-'}
                    </a>
                  </span>
                </div>
                {trade.txHash && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">TX Hash</span>
                    <span className="trade-detail-value trade-detail-mono">
                      <a href={`${config.explorerTx}${trade.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                        {shortenHash(trade.txHash)}
                      </a>
                    </span>
                  </div>
                )}
                {trade.evmTxHash && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">EVM TX Hash</span>
                    <span className="trade-detail-value trade-detail-mono">
                      <a href={`${config.explorerEvmTx}${trade.evmTxHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                        {shortenHash(trade.evmTxHash)}
                      </a>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="trade-detail-explainer">
            <h3 className="trade-detail-section-title">How Collateral & PnL Are Calculated</h3>
            <div className="trade-detail-explainer-content">
              <div className="trade-detail-explainer-item">
                <strong>Collateral</strong>
                <p>
                  The collateral is the margin deposited to open the position.
                  {!isStablecoin ? (
                    <> This trade uses <strong>{collSymbol}</strong> as collateral, which was worth <strong>${formatNumber(collPrice, 6)}</strong> at the time of the trade.
                    The raw collateral amount is {formatNumber(rawCollateral, 2)} {collSymbol}, converted to USD: {formatNumber(rawCollateral, 2)} × ${formatNumber(collPrice, 6)} = <strong>${formatNumber(collateralUsd, 2)}</strong>.</>
                  ) : (
                    <> This trade uses <strong>{collSymbol}</strong> (a stablecoin pegged to ~$1), so the collateral value is <strong>${formatNumber(collateralUsd, 2)}</strong>.</>
                  )}
                </p>
              </div>
              <div className="trade-detail-explainer-item">
                <strong>Position Size</strong>
                <p>
                  The total position size is the collateral multiplied by the leverage: ${formatNumber(collateralUsd, 2)} × {formatNumber(t.leverage, 1)}x = <strong>${formatNumber(collateralUsd * (parseFloat(t.leverage) || 1), 2)}</strong>.
                </p>
              </div>
              {(pnlUsd !== 0 || pnlPct !== 0) && (
                <div className="trade-detail-explainer-item">
                  <strong>Profit & Loss</strong>
                  <p>
                    PnL is realized when the position is closed or liquidated.
                    {!isStablecoin ? (
                      <> The raw PnL is {formatNumber(rawPnl, 2)} {collSymbol}, converted to USD using the collateral price: {formatNumber(rawPnl, 2)} × ${formatNumber(collPrice, 6)} = <strong>{pnlUsd > 0 ? '+' : ''}${formatNumber(pnlUsd, 2)}</strong>.</>
                    ) : (
                      <> The realized PnL is <strong>{pnlUsd > 0 ? '+' : ''}${formatNumber(pnlUsd, 2)}</strong>.</>
                    )}
                    {pnlPct !== 0 && <> This represents a <strong>{pnlPct > 0 ? '+' : ''}{formatNumber(pnlPct, 2)}%</strong> return on collateral.</>}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
