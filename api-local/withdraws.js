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
        id, network, depositor, shares, unlock_epoch, auto_redeem,
        vault_address, collateral_token_symbol
      FROM withdraws
      WHERE network = $1
      ORDER BY id DESC
      LIMIT $2
      OFFSET $3
    `, [network, parseInt(limit), parseInt(offset)]);

    // Transform to match frontend's expected format
    const withdraws = result.rows.map(row => ({
      depositor: row.depositor,
      shares: row.shares,
      unlockEpoch: row.unlock_epoch,
      autoRedeem: row.auto_redeem,
      vault: {
        address: row.vault_address,
        collateralToken: {
          symbol: row.collateral_token_symbol
        }
      }
    }));

    res.status(200).json(withdraws);
  } catch (error) {
    console.error('Error fetching withdraws:', error);
    res.status(500).json({ error: 'Failed to fetch withdraws', details: error.message });
  }
}
