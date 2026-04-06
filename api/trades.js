import { sql } from '../shared/db.js';
import { mapTradeRow } from '../shared/mappers.js';
import { validateNetwork, parsePagination } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sendServerError } from '../shared/http.js';

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
  if (!checkRateLimit(req, res)) return;

  try {
    const { network = 'mainnet', limit = 1000, offset = 0 } = req.query;
    if (!validateNetwork(network, res)) return;
    const pagination = parsePagination(limit, offset, res);
    if (!pagination) return;

    const result = await sql`
      SELECT
        id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
        tx_hash, evm_tx_hash, collateral_price, block_height, block_ts, created_at,
        trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
        collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol, tx_failed, dev_note, keeper_id
      FROM trades
      WHERE network = ${network}
        ${!process.env.VERCEL ? sql`` : sql`AND market_id < 1000`}
      ORDER BY block_ts DESC
      LIMIT ${pagination.limit}
      OFFSET ${pagination.offset}
    `;

    res.status(200).json(result.rows.map(row => mapTradeRow(row)));
  } catch (error) {
    return sendServerError(res, 'Failed to fetch trades', error);
  }
}
