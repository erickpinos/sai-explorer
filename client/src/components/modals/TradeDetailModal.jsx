import { useNetwork } from '../../hooks/useNetwork';
import { formatNumber, formatDate, formatPrice } from '../../utils/formatters';
import { getBadgeClass as getTradeTypeBadgeClass, formatTradeTypeBadge as getTradeTypeLabel, shortenHash, toUsd } from '../../utils/tradeHelpers';

export default function TradeDetailModal({ trade, onClose }) {
  const { config } = useNetwork();

  if (!trade) return null;

  const isInsightTrade = !trade.trade && trade.symbol;

  const t = trade.trade || {};
  const pb = t.perpBorrowing || {};
  const collPrice = parseFloat(trade.collateralPrice) || 1;
  const collSymbol = isInsightTrade ? '-' : (pb.collateralToken?.symbol || (collPrice < 0.5 ? 'stNIBI' : 'USDC'));
  const isStablecoin = isInsightTrade ? true : ['USDC', 'USDT'].includes(collSymbol.toUpperCase());
  const marketSymbol = isInsightTrade ? trade.symbol : (pb.baseToken?.symbol || '-');

  let rawCollateral, collateralUsd, rawOpenCollateral, openCollateralUsd, rawPnl, pnlUsd, pnlPct;

  if (isInsightTrade) {
    const leverage = parseFloat(trade.leverage) || 1;
    pnlUsd = parseFloat(trade.pnlUsd) || 0;
    collateralUsd = (parseFloat(trade.positionSize) || 0) / leverage;
    rawCollateral = collateralUsd;
    rawOpenCollateral = 0;
    openCollateralUsd = 0;
    rawPnl = pnlUsd;
    pnlPct = parseFloat(trade.pnlPct) || 0;
  } else {
    rawCollateral = (parseFloat(t.collateralAmount) || 0) / 1000000;
    collateralUsd = rawCollateral * collPrice;
    rawOpenCollateral = (parseFloat(t.openCollateralAmount) || 0) / 1000000;
    openCollateralUsd = rawOpenCollateral * collPrice;
    rawPnl = (parseFloat(trade.realizedPnlCollateral) || 0) / 1000000;
    pnlUsd = rawPnl * collPrice;
    pnlPct = parseFloat(trade.realizedPnlPct) || 0;
  }

  const tradeIsLong = isInsightTrade ? trade.isLong : t.isLong;
  const tradeLeverage = isInsightTrade ? trade.leverage : t.leverage;
  const tradeTrader = isInsightTrade ? trade.trader : t.trader;
  const tradeEvmTrader = isInsightTrade ? trade.evmTrader : t.evmTrader;
  const tradeTxHash = isInsightTrade ? trade.txHash : trade.txHash;
  const tradeEvmTxHash = isInsightTrade ? trade.evmTxHash : trade.evmTxHash;
  const tradeTimestamp = isInsightTrade ? trade.timestamp : trade.block?.block_ts;

  const displayType = isInsightTrade
    ? trade.type
    : (
      t.tradeType === 'limit' &&
      trade.tradeChangeType?.toLowerCase().includes('closed') &&
      !parseFloat(t.closePrice) &&
      !parseFloat(trade.realizedPnlCollateral)
    ) ? 'limit_order_cancelled' : trade.tradeChangeType;

  const hasTp = !isInsightTrade && parseFloat(t.tp) > 0;
  const hasSl = !isInsightTrade && parseFloat(t.sl) > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal trade-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2>Trade Details</h2>
            <span className={getTradeTypeBadgeClass(displayType)}>
              {getTradeTypeLabel(displayType)}
            </span>
            <span className={tradeIsLong ? 'badge badge-green' : 'badge badge-red'}>
              {tradeIsLong ? 'Long' : 'Short'}
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
                {!isInsightTrade && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Market ID</span>
                    <span className="trade-detail-value">{pb.marketId != null ? pb.marketId : '-'}</span>
                  </div>
                )}
                {!isInsightTrade && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Collateral Type</span>
                    <span className="trade-detail-value">
                      <span className="badge badge-purple" style={{ fontSize: '11px' }}>{collSymbol}</span>
                    </span>
                  </div>
                )}
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Direction</span>
                  <span className="trade-detail-value">
                    <span className={tradeIsLong ? 'badge badge-green' : 'badge badge-red'}>
                      {tradeIsLong ? 'Long' : 'Short'}
                    </span>
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Leverage</span>
                  <span className="trade-detail-value">{formatNumber(tradeLeverage, 1)}x</span>
                </div>
                {!isInsightTrade && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Order Type</span>
                    <span className="trade-detail-value" style={{ textTransform: 'capitalize' }}>{t.tradeType || '-'}</span>
                  </div>
                )}
                {!isInsightTrade && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Status</span>
                    <span className="trade-detail-value">{t.isOpen ? 'Open' : 'Closed'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="trade-detail-section">
              <h3 className="trade-detail-section-title">{isInsightTrade ? 'Date' : 'Pricing'}</h3>
              <div className="trade-detail-rows">
                {!isInsightTrade && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Open Price</span>
                    <span className="trade-detail-value">{formatPrice(t.openPrice || 0)}</span>
                  </div>
                )}
                {!isInsightTrade && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">Close Price</span>
                    <span className="trade-detail-value">
                      {parseFloat(t.closePrice) > 0 ? formatPrice(t.closePrice) : '-'}
                    </span>
                  </div>
                )}
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
                  <span className="trade-detail-value">{formatDate(tradeTimestamp)}</span>
                </div>
              </div>
            </div>

            <div className="trade-detail-section">
              <h3 className="trade-detail-section-title">Collateral</h3>
              <div className="trade-detail-rows">
                <div className="trade-detail-row">
                  <span className="trade-detail-label">{isInsightTrade ? 'Collateral' : 'Current Collateral'}</span>
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
                  <span className="trade-detail-value">${formatNumber(isInsightTrade ? (trade.positionSize || 0) : collateralUsd * (parseFloat(tradeLeverage) || 1), 2)}</span>
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
                    <a href={`https://nibiru.explorers.guru/account/${tradeTrader}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {tradeTrader || '-'}
                    </a>
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="trade-detail-label">Trader (EVM)</span>
                  <span className="trade-detail-value trade-detail-mono">
                    <a href={`https://nibiscan.io/address/${tradeEvmTrader}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                      {tradeEvmTrader || '-'}
                    </a>
                  </span>
                </div>
                {tradeTxHash && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">TX Hash</span>
                    <span className="trade-detail-value trade-detail-mono">
                      <a href={`${config.explorerTx}${tradeTxHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                        {shortenHash(tradeTxHash, 6)}
                      </a>
                    </span>
                  </div>
                )}
                {tradeEvmTxHash && (
                  <div className="trade-detail-row">
                    <span className="trade-detail-label">EVM TX Hash</span>
                    <span className="trade-detail-value trade-detail-mono">
                      <a href={`${config.explorerEvmTx}${tradeEvmTxHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash">
                        {shortenHash(tradeEvmTxHash, 6)}
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
                  The total position size is the collateral multiplied by the leverage: ${formatNumber(collateralUsd, 2)} × {formatNumber(tradeLeverage, 1)}x = <strong>${formatNumber(collateralUsd * (parseFloat(tradeLeverage) || 1), 2)}</strong>.
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
