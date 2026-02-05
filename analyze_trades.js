const fs = require('fs');

const trades = JSON.parse(fs.readFileSync('all_trades.json', 'utf8'));

// Helper to format USD
const fmt = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Daily breakdown
const byDate = {};
for (const t of trades) {
  const date = t.block?.block_ts?.split('T')[0];
  if (!date) continue;

  if (!byDate[date]) {
    byDate[date] = {
      date,
      total: 0,
      longsOpened: 0,
      shortsOpened: 0,
      liquidations: 0,
      totalPnl: 0,
      longVolume: 0,
      shortVolume: 0
    };
  }

  byDate[date].total++;

  const collateral = (t.trade?.collateralAmount || 0) / 1e6;
  const leverage = t.trade?.leverage || 1;
  const notional = collateral * leverage;

  if (t.tradeChangeType === 'position_opened') {
    if (t.trade?.isLong) {
      byDate[date].longsOpened++;
      byDate[date].longVolume += notional;
    } else {
      byDate[date].shortsOpened++;
      byDate[date].shortVolume += notional;
    }
  }

  if (t.tradeChangeType === 'position_liquidated') {
    byDate[date].liquidations++;
  }

  if (t.realizedPnlCollateral) {
    byDate[date].totalPnl += t.realizedPnlCollateral / 1e6;
  }
}

// Price-based asset analysis
const assets = {};
for (const t of trades) {
  const openPrice = t.trade?.openPrice;
  if (!openPrice) continue;

  // Guess asset by price range
  let asset;
  if (openPrice > 50000) asset = 'BTC';
  else if (openPrice > 1000 && openPrice < 10000) asset = 'ETH';
  else if (openPrice > 100 && openPrice < 1000) asset = 'SOL/BNB';
  else if (openPrice > 0.5 && openPrice < 5) asset = 'XRP/ADA';
  else if (openPrice < 0.5) asset = 'NIBI/Other';
  else asset = 'Unknown';

  if (!assets[asset]) {
    assets[asset] = { longs: 0, shorts: 0, longVol: 0, shortVol: 0 };
  }

  const collateral = (t.trade?.collateralAmount || 0) / 1e6;
  const leverage = t.trade?.leverage || 1;
  const notional = collateral * leverage;

  if (t.tradeChangeType === 'position_opened') {
    if (t.trade?.isLong) {
      assets[asset].longs++;
      assets[asset].longVol += notional;
    } else {
      assets[asset].shorts++;
      assets[asset].shortVol += notional;
    }
  }
}

// Leverage distribution
const leverageRanges = { '1-5x': 0, '6-10x': 0, '11-25x': 0, '26-50x': 0, '51-100x': 0 };
for (const t of trades) {
  const lev = t.trade?.leverage || 1;
  if (lev <= 5) leverageRanges['1-5x']++;
  else if (lev <= 10) leverageRanges['6-10x']++;
  else if (lev <= 25) leverageRanges['11-25x']++;
  else if (lev <= 50) leverageRanges['26-50x']++;
  else leverageRanges['51-100x']++;
}

// Top traders by volume
const traderVol = {};
for (const t of trades) {
  const trader = t.trade?.trader;
  if (!trader) continue;

  const collateral = (t.trade?.collateralAmount || 0) / 1e6;
  const leverage = t.trade?.leverage || 1;
  const notional = collateral * leverage;

  if (!traderVol[trader]) {
    traderVol[trader] = { volume: 0, trades: 0, pnl: 0 };
  }
  traderVol[trader].volume += notional;
  traderVol[trader].trades++;
  if (t.realizedPnlCollateral) {
    traderVol[trader].pnl += t.realizedPnlCollateral / 1e6;
  }
}

// Win rate analysis
let wins = 0, losses = 0, totalWin = 0, totalLoss = 0;
for (const t of trades) {
  if (t.realizedPnlCollateral > 0) {
    wins++;
    totalWin += t.realizedPnlCollateral / 1e6;
  } else if (t.realizedPnlCollateral < 0) {
    losses++;
    totalLoss += Math.abs(t.realizedPnlCollateral / 1e6);
  }
}

// Output
console.log('='.repeat(80));
console.log('PERPETUAL TRADING REPORT - SAI.FUN');
console.log('='.repeat(80));
console.log();

console.log('OVERVIEW');
console.log('-'.repeat(40));
console.log(`Total Trades: ${trades.length}`);
console.log(`Unique Traders: ${Object.keys(traderVol).length}`);
console.log(`Win Rate: ${((wins / (wins + losses)) * 100).toFixed(1)}% (${wins} wins / ${losses} losses)`);
console.log(`Total Profit from Wins: ${fmt(totalWin)}`);
console.log(`Total Loss from Losses: ${fmt(totalLoss)}`);
console.log(`Net PnL (all traders): ${fmt(totalWin - totalLoss)}`);
console.log();

console.log('MARKET SENTIMENT');
console.log('-'.repeat(40));
const totalLongs = trades.filter(t => t.tradeChangeType === 'position_opened' && t.trade?.isLong).length;
const totalShorts = trades.filter(t => t.tradeChangeType === 'position_opened' && !t.trade?.isLong).length;
console.log(`Opened Positions: ${totalLongs} LONG vs ${totalShorts} SHORT`);
console.log(`Long/Short Ratio: ${(totalLongs / totalShorts).toFixed(2)}:1`);
console.log(`Liquidations: ${trades.filter(t => t.tradeChangeType === 'position_liquidated').length}`);
console.log();

console.log('ASSET BREAKDOWN (by price inference)');
console.log('-'.repeat(40));
for (const [asset, data] of Object.entries(assets).sort((a, b) => (b[1].longVol + b[1].shortVol) - (a[1].longVol + a[1].shortVol))) {
  const sentiment = data.longs > data.shorts ? 'BULLISH' : data.shorts > data.longs ? 'BEARISH' : 'NEUTRAL';
  console.log(`${asset}: ${data.longs} longs, ${data.shorts} shorts (${sentiment})`);
  console.log(`  Volume: ${fmt(data.longVol)} long, ${fmt(data.shortVol)} short`);
}
console.log();

console.log('LEVERAGE DISTRIBUTION');
console.log('-'.repeat(40));
for (const [range, count] of Object.entries(leverageRanges)) {
  const pct = ((count / trades.length) * 100).toFixed(1);
  console.log(`${range}: ${count} trades (${pct}%)`);
}
console.log();

console.log('DAILY ACTIVITY (recent 10 days)');
console.log('-'.repeat(40));
const dates = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
for (const d of dates) {
  const sentiment = d.longsOpened > d.shortsOpened ? '🟢 BULLISH' : d.shortsOpened > d.longsOpened ? '🔴 BEARISH' : '⚪ NEUTRAL';
  console.log(`${d.date}: ${d.total} trades, ${d.longsOpened}L/${d.shortsOpened}S opened, ${d.liquidations} liqs, PnL: ${fmt(d.totalPnl)} ${sentiment}`);
}
console.log();

console.log('TOP 5 TRADERS BY VOLUME');
console.log('-'.repeat(40));
const topTraders = Object.entries(traderVol)
  .sort((a, b) => b[1].volume - a[1].volume)
  .slice(0, 5);
for (const [addr, data] of topTraders) {
  const shortAddr = addr.slice(0, 12) + '...' + addr.slice(-6);
  console.log(`${shortAddr}: ${fmt(data.volume)} volume, ${data.trades} trades, PnL: ${fmt(data.pnl)}`);
}

console.log();
console.log('='.repeat(80));
