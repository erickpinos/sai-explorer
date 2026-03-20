import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { useInsights } from '../../hooks/useApi';
import { useNetwork } from '../../hooks/useNetwork';

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

export default function FunFacts() {
  const navigate = useNavigate();
  const { network } = useNetwork();
  const { data: insights, loading } = useInsights(network);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('insights-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed || loading || !insights) return null;

  const hasData = insights.longVsShort &&
    (parseInt(insights.longVsShort.longCount) > 0 || parseInt(insights.longVsShort.shortCount) > 0);
  if (!hasData) return null;

  const facts = generateFunFacts(insights);
  if (facts.length === 0) return null;

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    try {
      sessionStorage.setItem('insights-dismissed', 'true');
    } catch { /* ignore */ }
  };

  return (
    <div className="fun-facts">
      <button className="fun-fact-dismiss" onClick={handleDismiss} title="Dismiss">
        <X size={16} />
      </button>
      <div className="fun-facts-grid">
        {facts.map((fact, i) => (
          <div key={i} className="fun-fact-card">
            <div className="fun-fact-icon"><Lightbulb size={20} /></div>
            <div className="fun-fact-content">
              <div className="fun-fact-text">{fact.text}</div>
              <div className="fun-fact-detail">{fact.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="fun-fact-link" onClick={() => navigate('/insights')}>
        More Insights &rarr;
      </button>
    </div>
  );
}
