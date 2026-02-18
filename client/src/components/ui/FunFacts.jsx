import { useInsights } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';
import { TABS } from '../../utils/constants';

function generateFunFacts(insights) {
  const facts = [];

  if (insights.mostProfitableMarket) {
    const dir = insights.profitByDirection;
    const betterDir = dir.long && dir.short
      ? (parseFloat(dir.long.avgPnlPct) > parseFloat(dir.short.avgPnlPct) ? 'going long' : 'shorting')
      : null;

    if (betterDir) {
      facts.push({
        text: `Traders made more money ${betterDir} on ${insights.mostProfitableMarket.symbol}`,
        detail: `Average PnL: ${insights.mostProfitableMarket.avgPnlPct > 0 ? '+' : ''}${insights.mostProfitableMarket.avgPnlPct}% across ${insights.mostProfitableMarket.tradeCount} trades`,
      });
    }
  }

  if (insights.biggestWin) {
    facts.push({
      text: `Biggest win: +${insights.biggestWin.pnlPct.toFixed(1)}% on a ${insights.biggestWin.isLong ? 'long' : 'short'} ${insights.biggestWin.symbol} trade`,
      detail: `Using ${insights.biggestWin.leverage}x leverage`,
    });
  }

  if (insights.longVsShort) {
    const dominant = parseFloat(insights.longVsShort.longPct) > 50 ? 'bullish' : 'bearish';
    const pct = parseFloat(insights.longVsShort.longPct) > 50
      ? insights.longVsShort.longPct
      : insights.longVsShort.shortPct;
    facts.push({
      text: `Traders are ${dominant} — ${pct}% of all positions are ${dominant === 'bullish' ? 'longs' : 'shorts'}`,
      detail: `${insights.longVsShort.longCount} longs vs ${insights.longVsShort.shortCount} shorts`,
    });
  }

  if (insights.liquidationRate) {
    facts.push({
      text: `${insights.liquidationRate.rate}% of closed trades ended in liquidation`,
      detail: `${insights.liquidationRate.liquidations} liquidations out of ${insights.liquidationRate.closedTrades} closed trades`,
    });
  }

  if (insights.avgLeverage) {
    facts.push({
      text: `Average leverage used is ${insights.avgLeverage}x`,
      detail: 'Across all trades on the platform',
    });
  }

  return facts;
}

export default function FunFacts({ onNavigateToInsights }) {
  const { network } = useNetwork();
  const { data: insights, loading } = useInsights(network);

  if (loading || !insights) return null;

  const hasData = insights.longVsShort &&
    (parseInt(insights.longVsShort.longCount) > 0 || parseInt(insights.longVsShort.shortCount) > 0);
  if (!hasData) return null;

  const facts = generateFunFacts(insights);
  if (facts.length === 0) return null;

  // Pick a rotating fact based on the current minute
  const featuredFact = facts[Math.floor(Date.now() / 60000) % facts.length];

  return (
    <div className="fun-facts">
      <div className="fun-fact-card">
        <div className="fun-fact-icon">&#x1f4a1;</div>
        <div className="fun-fact-content">
          <div className="fun-fact-text">{featuredFact.text}</div>
          <div className="fun-fact-detail">{featuredFact.detail}</div>
        </div>
        <button
          className="fun-fact-link"
          onClick={() => onNavigateToInsights(TABS.INSIGHTS)}
        >
          More Insights &rarr;
        </button>
      </div>
    </div>
  );
}
