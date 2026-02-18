import { useInsights } from '../hooks/useApi';
import { useNetwork } from '../hooks/useNetwork';
import { formatNumber, formatAddress, formatDate } from '../utils/formatters';
import ActivityChart from './charts/ActivityChart';
import VolumeChart from './charts/VolumeChart';

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
        <VolumeChart />
      </div>

      <div id="platform-stats" className="insights-grid">
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
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trader</th>
                  <th>Market</th>
                  <th>Direction</th>
                  <th>Leverage</th>
                  <th>PnL</th>
                  <th>Position Size</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {insights.topWins.map((t, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><span className="address-link">{formatAddress(t.evmTrader || t.trader)}</span></td>
                    <td>{t.symbol}</td>
                    <td><span className={`direction-badge ${t.isLong ? 'long' : 'short'}`}>{t.isLong ? 'Long' : 'Short'}</span></td>
                    <td>{t.leverage}x</td>
                    <td className="pnl-positive">+${formatNumber(t.pnlUsd, 2)}</td>
                    <td>${formatNumber(t.positionSize, 2)}</td>
                    <td>{t.type.replace('position_', '').replace(/_/g, ' ')}</td>
                    <td>{formatDate(t.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.topLosses?.length > 0 && (
        <div id="biggest-losses" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest Losses</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trader</th>
                  <th>Market</th>
                  <th>Direction</th>
                  <th>Leverage</th>
                  <th>PnL</th>
                  <th>Position Size</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {insights.topLosses.map((t, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><span className="address-link">{formatAddress(t.evmTrader || t.trader)}</span></td>
                    <td>{t.symbol}</td>
                    <td><span className={`direction-badge ${t.isLong ? 'long' : 'short'}`}>{t.isLong ? 'Long' : 'Short'}</span></td>
                    <td>{t.leverage}x</td>
                    <td className="pnl-negative">-${formatNumber(Math.abs(t.pnlUsd), 2)}</td>
                    <td>${formatNumber(t.positionSize, 2)}</td>
                    <td>{t.type.replace('position_', '').replace(/_/g, ' ')}</td>
                    <td>{formatDate(t.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.topPctWins?.length > 0 && (
        <div id="biggest-pct-wins" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest % Wins</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trader</th>
                  <th>Market</th>
                  <th>Direction</th>
                  <th>Leverage</th>
                  <th>PnL %</th>
                  <th>PnL $</th>
                  <th>Position Size</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {insights.topPctWins.map((t, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><span className="address-link">{formatAddress(t.evmTrader || t.trader)}</span></td>
                    <td>{t.symbol}</td>
                    <td><span className={`direction-badge ${t.isLong ? 'long' : 'short'}`}>{t.isLong ? 'Long' : 'Short'}</span></td>
                    <td>{t.leverage}x</td>
                    <td className="pnl-positive">+{formatNumber(t.pnlPct, 2)}%</td>
                    <td className="pnl-positive">+${formatNumber(t.pnlUsd, 2)}</td>
                    <td>${formatNumber(t.positionSize, 2)}</td>
                    <td>{t.type.replace('position_', '').replace(/_/g, ' ')}</td>
                    <td>{formatDate(t.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.topPctLosses?.length > 0 && (
        <div id="biggest-pct-losses" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Biggest % Losses</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trader</th>
                  <th>Market</th>
                  <th>Direction</th>
                  <th>Leverage</th>
                  <th>PnL %</th>
                  <th>PnL $</th>
                  <th>Position Size</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {insights.topPctLosses.map((t, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><span className="address-link">{formatAddress(t.evmTrader || t.trader)}</span></td>
                    <td>{t.symbol}</td>
                    <td><span className={`direction-badge ${t.isLong ? 'long' : 'short'}`}>{t.isLong ? 'Long' : 'Short'}</span></td>
                    <td>{t.leverage}x</td>
                    <td className="pnl-negative">{formatNumber(t.pnlPct, 2)}%</td>
                    <td className="pnl-negative">-${formatNumber(Math.abs(t.pnlUsd), 2)}</td>
                    <td>${formatNumber(t.positionSize, 2)}</td>
                    <td>{t.type.replace('position_', '').replace(/_/g, ' ')}</td>
                    <td>{formatDate(t.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
