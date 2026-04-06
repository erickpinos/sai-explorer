import { sql } from '../shared/db.js';
import { validateNetwork } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sendServerError } from '../shared/http.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res)) return;

  try {
    const { network = 'mainnet' } = req.query;
    if (!validateNetwork(network, res)) return;

    const result = await sql`
      SELECT market_id, base_token_symbol, collateral_token_symbol, data, updated_at
      FROM markets
      WHERE network = ${network}
        AND (data->>'symbolSource' IS DISTINCT FROM 'LCD')
        ${!process.env.VERCEL ? sql`` : sql`AND market_id < 1000`}
      ORDER BY market_id
    `;

    const markets = result.rows.map(row => ({
      marketId: row.market_id,
      ...row.data,
    }));

    res.status(200).json({ markets });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch markets', error);
  }
}
