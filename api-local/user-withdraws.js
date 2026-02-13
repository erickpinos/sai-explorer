import { pool } from '../scripts/db.js';

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

    const result = await pool.query(`
      SELECT *
      FROM withdraws
      WHERE network = $1 AND depositor = $2
      ORDER BY unlock_epoch DESC
      LIMIT $3
      OFFSET $4
    `, [network, address, parseInt(limit), parseInt(offset)]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching user withdraws:', error);
    res.status(500).json({ error: 'Failed to fetch user withdraws', details: error.message });
  }
}
