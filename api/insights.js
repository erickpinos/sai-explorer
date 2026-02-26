import { sql } from '@vercel/postgres';

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
      topWins,
      topLosses,
      topPctWins,
      topPctLosses,
      pnlSummary,
    ] = await Promise.all([
      sql`
        SELECT base_token_symbol, COUNT(*) as trade_count
        FROM trades
        WHERE network = ${network} AND base_token_symbol IS NOT NULL
        GROUP BY base_token_symbol
        ORDER BY trade_count DESC
        LIMIT 1
      `,

      sql`
        SELECT
          COUNT(*) FILTER (WHERE is_long = true) as long_count,
          COUNT(*) FILTER (WHERE is_long = false) as short_count
        FROM trades
        WHERE network = ${network}
      `,

      sql`
        SELECT realized_pnl_pct, base_token_symbol, is_long, leverage,
               realized_pnl_collateral / 1000000.0 * COALESCE(collateral_price, 1) as pnl_usd
        FROM trades
        WHERE network = ${network}
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'position_opened'
        ORDER BY realized_pnl_pct DESC
        LIMIT 1
      `,

      sql`
        SELECT realized_pnl_pct, base_token_symbol, is_long, leverage,
               realized_pnl_collateral / 1000000.0 * COALESCE(collateral_price, 1) as pnl_usd
        FROM trades
        WHERE network = ${network}
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'position_opened'
        ORDER BY realized_pnl_pct ASC
        LIMIT 1
      `,

      sql`
        SELECT AVG(leverage) as avg_leverage
        FROM trades
        WHERE network = ${network} AND leverage IS NOT NULL AND leverage > 0
      `,

      sql`
        SELECT trader, evm_trader, COUNT(*) as trade_count
        FROM trades
        WHERE network = ${network}
        GROUP BY trader, evm_trader
        ORDER BY trade_count DESC
        LIMIT 1
      `,

      sql`
        SELECT
          COUNT(*) FILTER (WHERE trade_change_type = 'position_liquidated') as liquidations,
          COUNT(*) FILTER (WHERE trade_change_type LIKE 'position_closed%' OR trade_change_type = 'position_liquidated') as closed_trades
        FROM trades
        WHERE network = ${network}
      `,

      sql`
        SELECT
          is_long,
          AVG(realized_pnl_pct) as avg_pnl_pct,
          COUNT(*) FILTER (WHERE realized_pnl_pct > 0) as winning_trades,
          COUNT(*) FILTER (WHERE realized_pnl_pct <= 0) as losing_trades
        FROM trades
        WHERE network = ${network}
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'position_opened'
        GROUP BY is_long
      `,

      sql`
        SELECT base_token_symbol, AVG(realized_pnl_pct) as avg_pnl_pct, COUNT(*) as trade_count
        FROM trades
        WHERE network = ${network}
          AND realized_pnl_pct IS NOT NULL
          AND trade_change_type != 'position_opened'
          AND base_token_symbol IS NOT NULL
        GROUP BY base_token_symbol
        HAVING COUNT(*) >= 5
        ORDER BY avg_pnl_pct DESC
        LIMIT 1
      `,

      sql`
        SELECT EXTRACT(HOUR FROM block_ts) as hour, COUNT(*) as trade_count
        FROM trades
        WHERE network = ${network} AND block_ts IS NOT NULL
        GROUP BY hour
        ORDER BY trade_count DESC
        LIMIT 1
      `,

      sql`
        SELECT trader, evm_trader, base_token_symbol, is_long,
          realized_pnl_collateral / 1000000.0 * COALESCE(collateral_price, 1) as pnl_usd,
          collateral_amount * leverage / 1000000.0 * COALESCE(collateral_price, 1) as position_size,
          leverage, trade_change_type, block_ts, tx_hash, evm_tx_hash
        FROM trades
        WHERE network = ${network} AND realized_pnl_collateral IS NOT NULL AND realized_pnl_collateral > 0
        ORDER BY realized_pnl_collateral * COALESCE(collateral_price, 1) DESC
        LIMIT 10
      `,

      sql`
        SELECT trader, evm_trader, base_token_symbol, is_long,
          realized_pnl_collateral / 1000000.0 * COALESCE(collateral_price, 1) as pnl_usd,
          collateral_amount * leverage / 1000000.0 * COALESCE(collateral_price, 1) as position_size,
          leverage, trade_change_type, block_ts, tx_hash, evm_tx_hash
        FROM trades
        WHERE network = ${network} AND realized_pnl_collateral IS NOT NULL AND realized_pnl_collateral < 0
        ORDER BY realized_pnl_collateral * COALESCE(collateral_price, 1) ASC
        LIMIT 10
      `,

      sql`
        SELECT trader, evm_trader, base_token_symbol, is_long,
          realized_pnl_pct,
          realized_pnl_collateral / 1000000.0 * COALESCE(collateral_price, 1) as pnl_usd,
          collateral_amount * leverage / 1000000.0 * COALESCE(collateral_price, 1) as position_size,
          leverage, trade_change_type, block_ts, tx_hash, evm_tx_hash
        FROM trades
        WHERE network = ${network} AND realized_pnl_pct IS NOT NULL AND realized_pnl_pct > 0
          AND trade_change_type != 'position_opened'
        ORDER BY realized_pnl_pct DESC
        LIMIT 10
      `,

      sql`
        SELECT trader, evm_trader, base_token_symbol, is_long,
          realized_pnl_pct,
          realized_pnl_collateral / 1000000.0 * COALESCE(collateral_price, 1) as pnl_usd,
          collateral_amount * leverage / 1000000.0 * COALESCE(collateral_price, 1) as position_size,
          leverage, trade_change_type, block_ts, tx_hash, evm_tx_hash
        FROM trades
        WHERE network = ${network} AND realized_pnl_pct IS NOT NULL AND realized_pnl_pct < 0
          AND trade_change_type != 'position_opened'
        ORDER BY realized_pnl_pct ASC
        LIMIT 10
      `,

      sql`
        SELECT
          SUM(CASE WHEN realized_pnl_collateral > 0 THEN realized_pnl_collateral * COALESCE(collateral_price, 1) ELSE 0 END) / 1000000.0 as total_wins,
          SUM(CASE WHEN realized_pnl_collateral < 0 THEN realized_pnl_collateral * COALESCE(collateral_price, 1) ELSE 0 END) / 1000000.0 as total_losses,
          COUNT(CASE WHEN realized_pnl_collateral > 0 THEN 1 END) as win_count,
          COUNT(CASE WHEN realized_pnl_collateral < 0 THEN 1 END) as loss_count
        FROM trades
        WHERE network = ${network} AND realized_pnl_collateral IS NOT NULL AND realized_pnl_collateral != 0
      `,
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
        pnlPct: parseFloat(biggestWin.rows[0].realized_pnl_pct) * 100,
        pnlUsd: parseFloat(biggestWin.rows[0].pnl_usd),
        symbol: biggestWin.rows[0].base_token_symbol,
        isLong: biggestWin.rows[0].is_long,
        leverage: parseFloat(biggestWin.rows[0].leverage),
      } : null,
      biggestLoss: biggestLoss.rows[0] ? {
        pnlPct: parseFloat(biggestLoss.rows[0].realized_pnl_pct) * 100,
        pnlUsd: parseFloat(biggestLoss.rows[0].pnl_usd),
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
          avgPnlPct: parseFloat((parseFloat(longStats.avg_pnl_pct) * 100).toFixed(2)),
          winRate: (parseInt(longStats.winning_trades) + parseInt(longStats.losing_trades)) > 0
            ? ((parseInt(longStats.winning_trades) / (parseInt(longStats.winning_trades) + parseInt(longStats.losing_trades))) * 100).toFixed(1)
            : 0,
        } : null,
        short: shortStats ? {
          avgPnlPct: parseFloat((parseFloat(shortStats.avg_pnl_pct) * 100).toFixed(2)),
          winRate: (parseInt(shortStats.winning_trades) + parseInt(shortStats.losing_trades)) > 0
            ? ((parseInt(shortStats.winning_trades) / (parseInt(shortStats.winning_trades) + parseInt(shortStats.losing_trades))) * 100).toFixed(1)
            : 0,
        } : null,
      },
      mostProfitableMarket: mostProfitableMarket.rows[0] ? {
        symbol: mostProfitableMarket.rows[0].base_token_symbol,
        avgPnlPct: parseFloat((parseFloat(mostProfitableMarket.rows[0].avg_pnl_pct) * 100).toFixed(2)),
        tradeCount: parseInt(mostProfitableMarket.rows[0].trade_count),
      } : null,
      busiestHour: busiestHour.rows[0] ? {
        hour: parseInt(busiestHour.rows[0].hour),
        tradeCount: parseInt(busiestHour.rows[0].trade_count),
      } : null,
      topWins: topWins.rows.map(r => ({
        trader: r.trader,
        evmTrader: r.evm_trader,
        symbol: r.base_token_symbol,
        isLong: r.is_long,
        pnlUsd: parseFloat(r.pnl_usd),
        positionSize: parseFloat(r.position_size),
        leverage: parseFloat(r.leverage),
        type: r.trade_change_type,
        timestamp: r.block_ts,
        txHash: r.tx_hash,
        evmTxHash: r.evm_tx_hash,
      })),
      topLosses: topLosses.rows.map(r => ({
        trader: r.trader,
        evmTrader: r.evm_trader,
        symbol: r.base_token_symbol,
        isLong: r.is_long,
        pnlUsd: parseFloat(r.pnl_usd),
        positionSize: parseFloat(r.position_size),
        leverage: parseFloat(r.leverage),
        type: r.trade_change_type,
        timestamp: r.block_ts,
        txHash: r.tx_hash,
        evmTxHash: r.evm_tx_hash,
      })),
      topPctWins: topPctWins.rows.map(r => ({
        trader: r.trader,
        evmTrader: r.evm_trader,
        symbol: r.base_token_symbol,
        isLong: r.is_long,
        pnlPct: parseFloat(r.realized_pnl_pct) * 100,
        pnlUsd: parseFloat(r.pnl_usd),
        positionSize: parseFloat(r.position_size),
        leverage: parseFloat(r.leverage),
        type: r.trade_change_type,
        timestamp: r.block_ts,
        txHash: r.tx_hash,
        evmTxHash: r.evm_tx_hash,
      })),
      topPctLosses: topPctLosses.rows.map(r => ({
        trader: r.trader,
        evmTrader: r.evm_trader,
        symbol: r.base_token_symbol,
        isLong: r.is_long,
        pnlPct: parseFloat(r.realized_pnl_pct) * 100,
        pnlUsd: parseFloat(r.pnl_usd),
        positionSize: parseFloat(r.position_size),
        leverage: parseFloat(r.leverage),
        type: r.trade_change_type,
        timestamp: r.block_ts,
        txHash: r.tx_hash,
        evmTxHash: r.evm_tx_hash,
      })),
      pnlSummary: pnlSummary.rows[0] ? {
        totalWins: parseFloat(pnlSummary.rows[0].total_wins || 0),
        totalLosses: parseFloat(pnlSummary.rows[0].total_losses || 0),
        winCount: parseInt(pnlSummary.rows[0].win_count || 0),
        lossCount: parseInt(pnlSummary.rows[0].loss_count || 0),
      } : null,
    };

    res.status(200).json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights', details: error.message });
  }
}
