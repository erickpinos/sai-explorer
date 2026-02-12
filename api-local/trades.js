import { pool } from '../scripts/db.js';

export default async function handler(req, res) {
  // Set CORS headers
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
    const { network = 'mainnet', limit = 1000, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT
        id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
        tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
        trader, trade_type, is_long, is_open, leverage, open_price, close_price,
        collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol
      FROM trades
      WHERE network = $1
      ORDER BY block_ts DESC
      LIMIT $2
      OFFSET $3
    `, [network, parseInt(limit), parseInt(offset)]);

    // Transform to match frontend's expected format
    const trades = result.rows.map(row => ({
      id: row.id,
      tradeChangeType: row.trade_change_type,
      realizedPnlPct: row.realized_pnl_pct,
      realizedPnlCollateral: row.realized_pnl_collateral,
      txHash: row.tx_hash,
      evmTxHash: row.evm_tx_hash,
      collateralPrice: row.collateral_price,
      block: {
        block: row.block_height,
        block_ts: row.block_ts
      },
      trade: {
        id: row.id,
        trader: row.trader,
        tradeType: row.trade_type,
        isLong: row.is_long,
        isOpen: row.is_open,
        leverage: row.leverage,
        openPrice: row.open_price,
        closePrice: row.close_price,
        collateralAmount: row.collateral_amount,
        openCollateralAmount: row.open_collateral_amount,
        tp: row.tp,
        sl: row.sl,
        perpBorrowing: {
          marketId: row.market_id,
          baseToken: {
            symbol: row.base_token_symbol
          }
        }
      }
    }));

    res.status(200).json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades', details: error.message });
  }
}
