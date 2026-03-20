import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, Scale, Trophy, Zap, TrendingUp, TrendingDown, BarChart2, AlertTriangle, DollarSign, User, Clock } from 'lucide-react';
import { useInsights } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatNumber, formatAddress } from '../utils/formatters';
import ActivityChart from './charts/ActivityChart';
import VolumeChart from './charts/VolumeChart';
import TradeDetailModal from './modals/TradeDetailModal';
import InsightsTradeTable from './tables/InsightsTradeTable';

function InsightCard({ icon, title, value, detail, valueClass }) {
  return (
    <div className="insight-card">
      <div className="insight-icon">{icon}</div>
      <div className="insight-title">{title}</div>
      <div className={`insight-value ${valueClass || ''}`}>{value}</div>
      {detail && <div className="insight-detail">{detail}</div>}
    </div>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { network, config } = useNetwork();
  const { data: insights, loading, error } = useInsights(network);
  const [selectedTrade, setSelectedTrade] = useState(null);

  const handleSelectUser = ({ bech32, evm }) => navigate(`/user/${evm || bech32}`, { state: { background: location } });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Computing insights...</span>
      </div>
    );
  }

  const hasData = insights &&
    (insights.mostTradedMarket || insights.longVsShort || insights.pnlSummary);

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

      <div className="chart-nav">
        <span className="chart-nav-label">Sections:</span>
        <a href="#daily-activity" className="chart-nav-link">Daily Activity</a>
        <a href="#daily-volume" className="chart-nav-link">Daily Volume</a>
        <a href="#platform-stats" className="chart-nav-link">Platform Stats</a>
        <a href="#pnl-summary" className="chart-nav-link">PnL Summary</a>
        <a href="#biggest-wins" className="chart-nav-link">Biggest Wins</a>
        <a href="#biggest-losses" className="chart-nav-link">Biggest Losses</a>
        <a href="#biggest-pct-wins" className="chart-nav-link">Top % Wins</a>
        <a href="#biggest-pct-losses" className="chart-nav-link">Top % Losses</a>
      </div>

      <div id="daily-activity" style={{ marginBottom: '2rem' }}>
        <ActivityChart />
      </div>
      <div id="daily-volume" style={{ marginBottom: '2rem' }}>
        <VolumeChart showMethodology />
      </div>

      <div id="platform-stats" className="insights-grid">
        {insights.mostTradedMarket && (
          <InsightCard
            icon={<Flame size={20} />}
            title="Most Traded Market"
            value={insights.mostTradedMarket.symbol}
            detail={`${formatNumber(insights.mostTradedMarket.tradeCount, 0)} trades`}
          />
        )}

        {insights.longVsShort && (
          <InsightCard
            icon={<Scale size={20} />}
            title="Long vs Short OI"
            value={`${insights.longVsShort.longPct}% Long / ${insights.longVsShort.shortPct}% Short`}
            detail={`$${formatNumber(insights.longVsShort.longOi, 2)} long / $${formatNumber(insights.longVsShort.shortOi, 2)} short`}
          />
        )}

        {insights.biggestWin && (
          <InsightCard
            icon={<Trophy size={20} />}
            title="Biggest % Win"
            value={`+${insights.biggestWin.pnlPct.toFixed(1)}%`}
            detail={`${insights.biggestWin.isLong ? 'Long' : 'Short'} ${insights.biggestWin.symbol} @ ${insights.biggestWin.leverage}x`}
            valueClass="pnl-positive"
          />
        )}

        {insights.biggestLoss && (
          <InsightCard
            icon={<Zap size={20} />}
            title="Biggest % Loss"
            value={`${insights.biggestLoss.pnlPct.toFixed(1)}%`}
            detail={`${insights.biggestLoss.isLong ? 'Long' : 'Short'} ${insights.biggestLoss.symbol} @ ${insights.biggestLoss.leverage}x`}
            valueClass="pnl-negative"
          />
        )}

        {insights.topWins?.[0] && (
          <InsightCard
            icon={<TrendingUp size={20} />}
            title="Biggest $ Win"
            value={`+$${formatNumber(insights.topWins[0].pnlUsd, 2)}`}
            detail={`${insights.topWins[0].isLong ? 'Long' : 'Short'} ${insights.topWins[0].symbol} @ ${insights.topWins[0].leverage}x`}
            valueClass="pnl-positive"
          />
        )}

        {insights.topLosses?.[0] && (
          <InsightCard
            icon={<TrendingDown size={20} />}
            title="Biggest $ Loss"
            value={`-$${formatNumber(Math.abs(insights.topLosses[0].pnlUsd), 2)}`}
            detail={`${insights.topLosses[0].isLong ? 'Long' : 'Short'} ${insights.topLosses[0].symbol} @ ${insights.topLosses[0].leverage}x`}
            valueClass="pnl-negative"
          />
        )}

        {insights.avgLeverage && (
          <InsightCard
            icon={<BarChart2 size={20} />}
            title="Average Leverage"
            value={`${insights.avgLeverage}x`}
            detail="Across all trades"
          />
        )}

        {insights.liquidationRate && (
          <InsightCard
            icon={<AlertTriangle size={20} />}
            title="Liquidation Rate"
            value={`${insights.liquidationRate.rate}%`}
            detail={`${formatNumber(insights.liquidationRate.liquidations, 0)} of ${formatNumber(insights.liquidationRate.closedTrades, 0)} closed trades`}
          />
        )}

        {insights.mostProfitableMarket && (
          <InsightCard
            icon={<DollarSign size={20} />}
            title="Most Profitable Market"
            value={insights.mostProfitableMarket.symbol}
            detail={`Avg PnL: ${insights.mostProfitableMarket.avgPnlPct > 0 ? '+' : ''}${insights.mostProfitableMarket.avgPnlPct}% (${insights.mostProfitableMarket.tradeCount} trades)`}
          />
        )}

        {insights.profitByDirection?.long && (
          <InsightCard
            icon={<TrendingUp size={20} />}
            title="Long Win Rate"
            value={`${insights.profitByDirection.long.winRate}%`}
            detail={`Avg PnL: ${insights.profitByDirection.long.avgPnlPct > 0 ? '+' : ''}${insights.profitByDirection.long.avgPnlPct}% (${formatNumber(insights.profitByDirection.long.tradeCount, 0)} trades)`}
          />
        )}

        {insights.profitByDirection?.short && (
          <InsightCard
            icon={<TrendingDown size={20} />}
            title="Short Win Rate"
            value={`${insights.profitByDirection.short.winRate}%`}
            detail={`Avg PnL: ${insights.profitByDirection.short.avgPnlPct > 0 ? '+' : ''}${insights.profitByDirection.short.avgPnlPct}% (${formatNumber(insights.profitByDirection.short.tradeCount, 0)} trades)`}
          />
        )}

        {insights.mostActiveTrader && (
          <InsightCard
            icon={<User size={20} />}
            title="Most Active Trader"
            value={formatAddress(insights.mostActiveTrader.evmTrader || insights.mostActiveTrader.trader)}
            detail={`${formatNumber(insights.mostActiveTrader.tradeCount, 0)} trades`}
          />
        )}

        {insights.busiestHour != null && (
          <InsightCard
            icon={<Clock size={20} />}
            title="Busiest Trading Hour"
            value={`${formatHour(insights.busiestHour.hour)} UTC`}
            detail={`${formatNumber(insights.busiestHour.tradeCount, 0)} trades`}
          />
        )}
      </div>

      {insights.pnlSummary && (
        <div id="pnl-summary" className="insights-summary" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="insight-card" style={{ flex: 1, minWidth: '200px' }}>
            <div className="insight-title">Total Wins</div>
            <div className="insight-value pnl-positive">+${formatNumber(insights.pnlSummary.totalWins, 2)}</div>
            <div className="insight-detail">{insights.pnlSummary.winCount} winning trades</div>
          </div>
          <div className="insight-card" style={{ flex: 1, minWidth: '200px' }}>
            <div className="insight-title">Total Losses</div>
            <div className="insight-value pnl-negative">-${formatNumber(Math.abs(insights.pnlSummary.totalLosses), 2)}</div>
            <div className="insight-detail">{insights.pnlSummary.lossCount} losing trades</div>
          </div>
          <div className="insight-card" style={{ flex: 1, minWidth: '200px' }}>
            <div className="insight-title">Net PnL</div>
            <div className={`insight-value ${(insights.pnlSummary.totalWins + insights.pnlSummary.totalLosses) >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
              {(insights.pnlSummary.totalWins + insights.pnlSummary.totalLosses) >= 0 ? '+' : '-'}${formatNumber(Math.abs(insights.pnlSummary.totalWins + insights.pnlSummary.totalLosses), 2)}
            </div>
            <div className="insight-detail">{insights.pnlSummary.winCount + insights.pnlSummary.lossCount} total trades</div>
          </div>
        </div>
      )}

      {insights.topWins?.length > 0 && (
        <div id="biggest-wins" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest Wins</h3>
          <InsightsTradeTable trades={insights.topWins} config={config} onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} />
        </div>
      )}

      {insights.topLosses?.length > 0 && (
        <div id="biggest-losses" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest Losses</h3>
          <InsightsTradeTable trades={insights.topLosses} config={config} isLoss onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} />
        </div>
      )}

      {insights.topPctWins?.length > 0 && (
        <div id="biggest-pct-wins" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest % Wins</h3>
          <InsightsTradeTable trades={insights.topPctWins} config={config} isPct onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} />
        </div>
      )}

      {insights.topPctLosses?.length > 0 && (
        <div id="biggest-pct-losses" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest % Losses</h3>
          <InsightsTradeTable trades={insights.topPctLosses} config={config} isPct isLoss onSelectUser={handleSelectUser} onSelectTrade={setSelectedTrade} />
        </div>
      )}

    </div>
  );
}
