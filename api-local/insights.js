import { pool } from '../scripts/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { network = 'mainnet' } = req.query;

    const [
      mostTradedMarket,
      longVsShort,
      biggestWin,
      biggestLoss,
      avgLeverage,
      mostActiveTrader,
      liquidationRate,
      profitByDirection,
      mostProfitableMarket,
      busiestHour,
    ] = await Promise.all([
      pool.query(`
        SELECT base_token_symbol, COUNT(*) as trade_count
        FROM trades
        WHERE network = $1 AND base_token_symbol IS NOT NULL
        GROUP BY base_token_symbol
        ORDER BY trade_count DESC
        LIMIT 1
      `, [network]),

      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_long = true) as long_count,
          COUNT(*) FILTER (WHERE is_long = false) as short_count
        FROM trades
        WHERE network = $1
      `, [network]),

      pool.query(`
        SELECT realized_pnl_pct, base_token_symbol, is_long, leverage
        FROM trades
        WHERE network = $1
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'open'
        ORDER BY realized_pnl_pct DESC
        LIMIT 1
      `, [network]),

      pool.query(`
        SELECT realized_pnl_pct, base_token_symbol, is_long, leverage
        FROM trades
        WHERE network = $1
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'open'
        ORDER BY realized_pnl_pct ASC
        LIMIT 1
      `, [network]),

      pool.query(`
        SELECT AVG(leverage) as avg_leverage
        FROM trades
        WHERE network = $1 AND leverage IS NOT NULL AND leverage > 0
      `, [network]),

      pool.query(`
        SELECT trader, evm_trader, COUNT(*) as trade_count
        FROM trades
        WHERE network = $1
        GROUP BY trader, evm_trader
        ORDER BY trade_count DESC
        LIMIT 1
      `, [network]),

      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE trade_change_type = 'position_liquidated') as liquidations,
          COUNT(*) FILTER (WHERE trade_change_type LIKE 'position_closed%' OR trade_change_type = 'position_liquidated') as closed_trades
        FROM trades
        WHERE network = $1
      `, [network]),

      pool.query(`
        SELECT
          is_long,
          AVG(realized_pnl_pct) as avg_pnl_pct,
          COUNT(*) FILTER (WHERE realized_pnl_pct > 0) as winning_trades,
          COUNT(*) FILTER (WHERE realized_pnl_pct <= 0) as losing_trades
        FROM trades
        WHERE network = $1
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'open'
        GROUP BY is_long
      `, [network]),

      pool.query(`
        SELECT base_token_symbol, AVG(realized_pnl_pct) as avg_pnl_pct, COUNT(*) as trade_count
        FROM trades
        WHERE network = $1
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'open'
          AND base_token_symbol IS NOT NULL
        GROUP BY base_token_symbol
        HAVING COUNT(*) >= 5
        ORDER BY avg_pnl_pct DESC
        LIMIT 1
      `, [network]),

      pool.query(`
        SELECT EXTRACT(HOUR FROM block_ts) as hour, COUNT(*) as trade_count
        FROM trades
        WHERE network = $1 AND block_ts IS NOT NULL
        GROUP BY hour
        ORDER BY trade_count DESC
        LIMIT 1
      `, [network]),
    ]);

    const longCount = parseInt(longVsShort.rows[0]?.long_count || 0);
    const shortCount = parseInt(longVsShort.rows[0]?.short_count || 0);
    const totalDirectional = longCount + shortCount;

    const liquidations = parseInt(liquidationRate.rows[0]?.liquidations || 0);
    const closedTrades = parseInt(liquidationRate.rows[0]?.closed_trades || 0);

    const longStats = profitByDirection.rows.find(r => r.is_long === true);
    const shortStats = profitByDirection.rows.find(r => r.is_long === false);

    const insights = {
      network,
      mostTradedMarket: mostTradedMarket.rows[0] ? {
        symbol: mostTradedMarket.rows[0].base_token_symbol,
        tradeCount: parseInt(mostTradedMarket.rows[0].trade_count),
      } : null,
      longVsShort: {
        longCount,
        shortCount,
        longPct: totalDirectional > 0 ? ((longCount / totalDirectional) * 100).toFixed(1) : 0,
        shortPct: totalDirectional > 0 ? ((shortCount / totalDirectional) * 100).toFixed(1) : 0,
      },
      biggestWin: biggestWin.rows[0] ? {
        pnlPct: parseFloat(biggestWin.rows[0].realized_pnl_pct),
        symbol: biggestWin.rows[0].base_token_symbol,
        isLong: biggestWin.rows[0].is_long,
        leverage: parseFloat(biggestWin.rows[0].leverage),
      } : null,
      biggestLoss: biggestLoss.rows[0] ? {
        pnlPct: parseFloat(biggestLoss.rows[0].realized_pnl_pct),
        symbol: biggestLoss.rows[0].base_token_symbol,
        isLong: biggestLoss.rows[0].is_long,
        leverage: parseFloat(biggestLoss.rows[0].leverage),
      } : null,
      avgLeverage: avgLeverage.rows[0]?.avg_leverage
        ? parseFloat(parseFloat(avgLeverage.rows[0].avg_leverage).toFixed(1))
        : null,
      mostActiveTrader: mostActiveTrader.rows[0] ? {
        trader: mostActiveTrader.rows[0].trader,
        evmTrader: mostActiveTrader.rows[0].evm_trader,
        tradeCount: parseInt(mostActiveTrader.rows[0].trade_count),
      } : null,
      liquidationRate: closedTrades > 0 ? {
        rate: ((liquidations / closedTrades) * 100).toFixed(1),
        liquidations,
        closedTrades,
      } : null,
      profitByDirection: {
        long: longStats ? {
          avgPnlPct: parseFloat(parseFloat(longStats.avg_pnl_pct).toFixed(2)),
          winRate: (parseInt(longStats.winning_trades) + parseInt(longStats.losing_trades)) > 0
            ? ((parseInt(longStats.winning_trades) / (parseInt(longStats.winning_trades) + parseInt(longStats.losing_trades))) * 100).toFixed(1)
            : 0,
        } : null,
        short: shortStats ? {
          avgPnlPct: parseFloat(parseFloat(shortStats.avg_pnl_pct).toFixed(2)),
          winRate: (parseInt(shortStats.winning_trades) + parseInt(shortStats.losing_trades)) > 0
            ? ((parseInt(shortStats.winning_trades) / (parseInt(shortStats.winning_trades) + parseInt(shortStats.losing_trades))) * 100).toFixed(1)
            : 0,
        } : null,
      },
      mostProfitableMarket: mostProfitableMarket.rows[0] ? {
        symbol: mostProfitableMarket.rows[0].base_token_symbol,
        avgPnlPct: parseFloat(parseFloat(mostProfitableMarket.rows[0].avg_pnl_pct).toFixed(2)),
        tradeCount: parseInt(mostProfitableMarket.rows[0].trade_count),
      } : null,
      busiestHour: busiestHour.rows[0] ? {
        hour: parseInt(busiestHour.rows[0].hour),
        tradeCount: parseInt(busiestHour.rows[0].trade_count),
      } : null,
    };

    res.status(200).json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights', details: error.message });
  }
}
