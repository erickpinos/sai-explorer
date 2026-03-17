import { sql } from '../shared/db.js';
import { checkRateLimit } from '../shared/rateLimit.js';

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
    console.error('Error fetching coingecko prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices', details: error.message });
  }
}
