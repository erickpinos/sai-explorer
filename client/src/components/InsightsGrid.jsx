import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, Scale, Trophy, Zap, TrendingUp, TrendingDown, BarChart2, AlertTriangle, DollarSign, User, Clock } from 'lucide-react';
import { useInsights } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatNumber, formatAddress } from '../utils/formatters';
import InsightsTradeTable from './tables/InsightsTradeTable';
import TradeDetailModal from './modals/TradeDetailModal';

function InsightCard({ icon, title, value, detail, valueClass }) {
  return (
    <div className="insight-card">
      {icon && <div className="insight-icon">{icon}</div>}
      <div className="insight-title">{title}</div>
      <div className={`insight-value ${valueClass || ''}`}>{value}</div>
      {detail && <div className="insight-detail">{detail}</div>}
    </div>
  );
}

const formatHour = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
};

export default function InsightsGrid() {
  const { network, config } = useNetwork();
  const { data: insights, loading } = useInsights(network);
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTrade, setSelectedTrade] = useState(null);

  const handleSelectUser = ({ bech32, evm }) =>
    navigate(`/user/${evm || bech32}`, { state: { background: location } });

  if (loading) return <div className="loading"><div className="spinner" /><span>Computing insights...</span></div>;

  const hasData = insights && (insights.mostTradedMarket || insights.longVsShort || insights.pnlSummary);
  if (!hasData) return null;

  return (
    <>
    <div className="insights-grid">
      {insights.mostTradedMarket && (
        <InsightCard icon={<Flame size={20} />} title="Most Traded Market"
          value={insights.mostTradedMarket.symbol}
          detail={`${formatNumber(insights.mostTradedMarket.tradeCount, 0)} trades`} />
      )}
      {insights.longVsShort && (
        <InsightCard icon={<Scale size={20} />} title="Long vs Short OI"
          value={`${insights.longVsShort.longPct}% Long / ${insights.longVsShort.shortPct}% Short`}
          detail={`$${formatNumber(insights.longVsShort.longOi, 2)} long / $${formatNumber(insights.longVsShort.shortOi, 2)} short`} />
      )}
      {insights.biggestWin && (
        <InsightCard icon={<Trophy size={20} />} title="Biggest % Win"
          value={`+${insights.biggestWin.pnlPct.toFixed(1)}%`}
          detail={`${insights.biggestWin.isLong ? 'Long' : 'Short'} ${insights.biggestWin.symbol} @ ${insights.biggestWin.leverage}x`}
          valueClass="pnl-positive" />
      )}
      {insights.biggestLoss && (
        <InsightCard icon={<Zap size={20} />} title="Biggest % Loss"
          value={`${insights.biggestLoss.pnlPct.toFixed(1)}%`}
          detail={`${insights.biggestLoss.isLong ? 'Long' : 'Short'} ${insights.biggestLoss.symbol} @ ${insights.biggestLoss.leverage}x`}
          valueClass="pnl-negative" />
      )}
      {insights.topWins?.[0] && (
        <InsightCard icon={<TrendingUp size={20} />} title="Biggest $ Win"
          value={`+$${formatNumber(insights.topWins[0].pnlUsd, 2)}`}
          detail={`${insights.topWins[0].isLong ? 'Long' : 'Short'} ${insights.topWins[0].symbol} @ ${insights.topWins[0].leverage}x`}
          valueClass="pnl-positive" />
      )}
      {insights.topLosses?.[0] && (
        <InsightCard icon={<TrendingDown size={20} />} title="Biggest $ Loss"
          value={`-$${formatNumber(Math.abs(insights.topLosses[0].pnlUsd), 2)}`}
          detail={`${insights.topLosses[0].isLong ? 'Long' : 'Short'} ${insights.topLosses[0].symbol} @ ${insights.topLosses[0].leverage}x`}
          valueClass="pnl-negative" />
      )}
      {insights.avgLeverage && (
        <InsightCard icon={<BarChart2 size={20} />} title="Average Leverage"
          value={`${insights.avgLeverage}x`} detail="Across all trades" />
      )}
      {insights.liquidationRate && (
        <InsightCard icon={<AlertTriangle size={20} />} title="Liquidation Rate"
          value={`${insights.liquidationRate.rate}%`}
          detail={`${formatNumber(insights.liquidationRate.liquidations, 0)} of ${formatNumber(insights.liquidationRate.closedTrades, 0)} closed trades`} />
      )}
      {insights.mostProfitableMarket && (
        <InsightCard icon={<DollarSign size={20} />} title="Most Profitable Market"
          value={insights.mostProfitableMarket.symbol}
          detail={`Avg PnL: ${insights.mostProfitableMarket.avgPnlPct > 0 ? '+' : ''}${insights.mostProfitableMarket.avgPnlPct}% (${insights.mostProfitableMarket.tradeCount} trades)`} />
      )}
      {insights.profitByDirection?.long && (
        <InsightCard icon={<TrendingUp size={20} />} title="Long Win Rate"
          value={`${insights.profitByDirection.long.winRate}%`}
          detail={`Avg PnL: ${insights.profitByDirection.long.avgPnlPct > 0 ? '+' : ''}${insights.profitByDirection.long.avgPnlPct}% (${formatNumber(insights.profitByDirection.long.tradeCount, 0)} trades)`} />
      )}
      {insights.profitByDirection?.short && (
        <InsightCard icon={<TrendingDown size={20} />} title="Short Win Rate"
          value={`${insights.profitByDirection.short.winRate}%`}
          detail={`Avg PnL: ${insights.profitByDirection.short.avgPnlPct > 0 ? '+' : ''}${insights.profitByDirection.short.avgPnlPct}% (${formatNumber(insights.profitByDirection.short.tradeCount, 0)} trades)`} />
      )}
      {insights.mostActiveTrader && (
        <InsightCard icon={<User size={20} />} title="Most Active Trader"
          value={formatAddress(insights.mostActiveTrader.evmTrader || insights.mostActiveTrader.trader)}
          detail={`${formatNumber(insights.mostActiveTrader.tradeCount, 0)} trades`} />
      )}
      {insights.busiestHour != null && (
        <InsightCard icon={<Clock size={20} />} title="Busiest Trading Hour"
          value={`${formatHour(insights.busiestHour.hour)} UTC`}
          detail={`${formatNumber(insights.busiestHour.tradeCount, 0)} trades`} />
      )}
      {insights.pnlSummary && (
        <>
          <InsightCard title="Total Wins"
            value={`+$${formatNumber(insights.pnlSummary.totalWins, 2)}`}
            detail={`${insights.pnlSummary.winCount} winning trades`}
            valueClass="pnl-positive" />
          <InsightCard title="Total Losses"
            value={`-$${formatNumber(Math.abs(insights.pnlSummary.totalLosses), 2)}`}
            detail={`${insights.pnlSummary.lossCount} losing trades`}
            valueClass="pnl-negative" />
          <InsightCard title="Net PnL"
            value={`${(insights.pnlSummary.totalWins + insights.pnlSummary.totalLosses) >= 0 ? '+' : '-'}$${formatNumber(Math.abs(insights.pnlSummary.totalWins + insights.pnlSummary.totalLosses), 2)}`}
            detail={`${insights.pnlSummary.winCount + insights.pnlSummary.lossCount} total trades`}
            valueClass={(insights.pnlSummary.totalWins + insights.pnlSummary.totalLosses) >= 0 ? 'pnl-positive' : 'pnl-negative'} />
        </>
      )}
    </div>

    {insights.topWins?.length > 0 && (
      <div style={{ marginTop: '2rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Biggest Wins</h3>
        <InsightsTradeTable trades={insights.topWins} config={config} onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} tableKey="insights-top-wins" />
      </div>
    )}

    {insights.topLosses?.length > 0 && (
      <div style={{ marginTop: '2rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Biggest Losses</h3>
        <InsightsTradeTable trades={insights.topLosses} config={config} isLoss onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} tableKey="insights-top-losses" />
      </div>
    )}

    {insights.topPctWins?.length > 0 && (
      <div style={{ marginTop: '2rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Biggest % Wins</h3>
        <InsightsTradeTable trades={insights.topPctWins} config={config} isPct onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} tableKey="insights-top-pct-wins" />
      </div>
    )}

    {insights.topPctLosses?.length > 0 && (
      <div style={{ marginTop: '2rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Biggest % Losses</h3>
        <InsightsTradeTable trades={insights.topPctLosses} config={config} isPct isLoss onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} tableKey="insights-top-pct-losses" />
      </div>
    )}

    {selectedTrade && (
      <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
    )}
    </>
  );
}
