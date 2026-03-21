import { sql } from '../shared/db.js';
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
    const { rows } = await sql`
      SELECT coin_id, date, price_usd, fetched_at
      FROM coingecko_prices
      ORDER BY coin_id, date DESC
    `;
    res.status(200).json({ prices: rows });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch prices', error);
  }
}
