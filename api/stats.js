import { sql } from '@vercel/postgres';

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
    const { network = 'mainnet' } = req.query;

    // Run parallel queries for stats
    const [tradesStats, depositsStats, uniqueTraders, recentTrades] = await Promise.all([
      // Total trades count and volume
      sql`
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN collateral_amount IS NOT NULL THEN ABS(collateral_amount) ELSE 0 END) as total_volume
        FROM trades
        WHERE network = ${network}
      `,

      // Total deposits
      sql`
        SELECT
          COUNT(*) as total_deposits,
          SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_deposited
        FROM deposits
        WHERE network = ${network}
      `,

      // Unique traders count
      sql`
        SELECT COUNT(DISTINCT trader) as unique_traders
        FROM trades
        WHERE network = ${network}
      `,

      // Most recent trade timestamp
      sql`
        SELECT block_ts
        FROM trades
        WHERE network = ${network}
        ORDER BY block_ts DESC
        LIMIT 1
      `
    ]);

    const stats = {
      network,
      trades: {
        total: parseInt(tradesStats.rows[0]?.total_trades || 0),
        volume: parseFloat(tradesStats.rows[0]?.total_volume || 0)
      },
      deposits: {
        total: parseInt(depositsStats.rows[0]?.total_deposits || 0),
        volume: parseFloat(depositsStats.rows[0]?.total_deposited || 0)
      },
      traders: {
        unique: parseInt(uniqueTraders.rows[0]?.unique_traders || 0)
      },
      lastUpdated: recentTrades.rows[0]?.block_ts || null
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}
