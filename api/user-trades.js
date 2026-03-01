import { sql } from '@vercel/postgres';
import { mapTradeRow } from '../shared/mappers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { network = 'mainnet', address, limit = 1000, offset = 0 } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Address parameter required' });
    }

    const result = await sql`
      SELECT
        id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
        tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
        trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
        collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol
      FROM trades
      WHERE network = ${network}
        AND (trader = ${address} OR evm_trader = ${address})
      ORDER BY block_ts DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    res.status(200).json(result.rows.map(mapTradeRow));
  } catch (error) {
    console.error('Error fetching user trades:', error);
    res.status(500).json({ error: 'Failed to fetch user trades', details: error.message });
  }
}
