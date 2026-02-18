import { useInsights } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatNumber, formatAddress } from '../utils/formatters';

function InsightCard({ icon, title, value, detail }) {
  return (
    <div className="insight-card">
      <div className="insight-icon">{icon}</div>
      <div className="insight-title">{title}</div>
      <div className="insight-value">{value}</div>
      {detail && <div className="insight-detail">{detail}</div>}
    </div>
  );
}

export default function InsightsPage() {
  const { network } = useNetwork();
  const { data: insights, loading, error } = useInsights(network);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Computing insights...</span>
      </div>
    );
  }

  const hasData = insights &&
    insights.longVsShort &&
    (parseInt(insights.longVsShort.longCount) > 0 || parseInt(insights.longVsShort.shortCount) > 0);

  if (error || !insights || !hasData) {
    return (
      <div className="empty">
        <p>No insights available yet. Fetch some transactions first!</p>
      </div>
    );
  }

  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  return (
    <div className="insights-page">
      <div className="insights-header">
        <h2 className="insights-title">Platform Insights</h2>
        <p className="insights-subtitle">Interesting patterns and stats from the trading data</p>
      </div>

      <div className="insights-grid">
        {insights.mostTradedMarket && (
          <InsightCard
            icon="&#x1f525;"
            title="Most Traded Market"
            value={insights.mostTradedMarket.symbol}
            detail={`${formatNumber(insights.mostTradedMarket.tradeCount, 0)} trades`}
          />
        )}

        {insights.longVsShort && (
          <InsightCard
            icon="&#x2696;&#xfe0f;"
            title="Long vs Short"
            value={`${insights.longVsShort.longPct}% Long / ${insights.longVsShort.shortPct}% Short`}
            detail={`${formatNumber(insights.longVsShort.longCount, 0)} longs, ${formatNumber(insights.longVsShort.shortCount, 0)} shorts`}
          />
        )}

        {insights.biggestWin && (
          <InsightCard
            icon="&#x1f3c6;"
            title="Biggest Win"
            value={`+${insights.biggestWin.pnlPct.toFixed(1)}%`}
            detail={`${insights.biggestWin.isLong ? 'Long' : 'Short'} ${insights.biggestWin.symbol} @ ${insights.biggestWin.leverage}x`}
          />
        )}

        {insights.biggestLoss && (
          <InsightCard
            icon="&#x1f4a5;"
            title="Biggest Loss"
            value={`${insights.biggestLoss.pnlPct.toFixed(1)}%`}
            detail={`${insights.biggestLoss.isLong ? 'Long' : 'Short'} ${insights.biggestLoss.symbol} @ ${insights.biggestLoss.leverage}x`}
          />
        )}

        {insights.avgLeverage && (
          <InsightCard
            icon="&#x1f4ca;"
            title="Average Leverage"
            value={`${insights.avgLeverage}x`}
            detail="Across all trades"
          />
        )}

        {insights.liquidationRate && (
          <InsightCard
            icon="&#x26a0;&#xfe0f;"
            title="Liquidation Rate"
            value={`${insights.liquidationRate.rate}%`}
            detail={`${formatNumber(insights.liquidationRate.liquidations, 0)} of ${formatNumber(insights.liquidationRate.closedTrades, 0)} closed trades`}
          />
        )}

        {insights.mostProfitableMarket && (
          <InsightCard
            icon="&#x1f4b0;"
            title="Most Profitable Market"
            value={insights.mostProfitableMarket.symbol}
            detail={`Avg PnL: ${insights.mostProfitableMarket.avgPnlPct > 0 ? '+' : ''}${insights.mostProfitableMarket.avgPnlPct}% (${insights.mostProfitableMarket.tradeCount} trades)`}
          />
        )}

        {insights.profitByDirection?.long && (
          <InsightCard
            icon="&#x1f7e2;"
            title="Long Win Rate"
            value={`${insights.profitByDirection.long.winRate}%`}
            detail={`Avg PnL: ${insights.profitByDirection.long.avgPnlPct > 0 ? '+' : ''}${insights.profitByDirection.long.avgPnlPct}%`}
          />
        )}

        {insights.profitByDirection?.short && (
          <InsightCard
            icon="&#x1f534;"
            title="Short Win Rate"
            value={`${insights.profitByDirection.short.winRate}%`}
            detail={`Avg PnL: ${insights.profitByDirection.short.avgPnlPct > 0 ? '+' : ''}${insights.profitByDirection.short.avgPnlPct}%`}
          />
        )}

        {insights.mostActiveTrader && (
          <InsightCard
            icon="&#x1f451;"
            title="Most Active Trader"
            value={formatAddress(insights.mostActiveTrader.evmTrader || insights.mostActiveTrader.trader)}
            detail={`${formatNumber(insights.mostActiveTrader.tradeCount, 0)} trades`}
          />
        )}

        {insights.busiestHour != null && (
          <InsightCard
            icon="&#x23f0;"
            title="Busiest Trading Hour"
            value={`${formatHour(insights.busiestHour.hour)} UTC`}
            detail={`${formatNumber(insights.busiestHour.tradeCount, 0)} trades`}
          />
        )}
      </div>
    </div>
  );
}
