import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { network = 'mainnet', days = '28' } = req.query;

    const cutoff = days === 'all'
      ? null
      : new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [tradesResult, depositsResult] = await Promise.all([
      cutoff
        ? sql`
          SELECT
            DATE(block_ts) as day,
            COUNT(*) as trade_count,
            SUM(CASE WHEN trade_change_type NOT IN ('tp_updated', 'sl_updated', 'limit_order_created', 'limit_order_cancelled', 'stop_order_created', 'stop_order_cancelled')
                THEN ABS(collateral_amount * leverage / 1000000 * COALESCE(collateral_price, 1)) ELSE 0 END) as volume
          FROM trades
          WHERE network = ${network} AND block_ts >= ${cutoff.toISOString()}
          GROUP BY DATE(block_ts)
          ORDER BY day ASC
        `
        : sql`
          SELECT
            DATE(block_ts) as day,
            COUNT(*) as trade_count,
            SUM(CASE WHEN trade_change_type NOT IN ('tp_updated', 'sl_updated', 'limit_order_created', 'limit_order_cancelled', 'stop_order_created', 'stop_order_cancelled')
                THEN ABS(collateral_amount * leverage / 1000000 * COALESCE(collateral_price, 1)) ELSE 0 END) as volume
          FROM trades
          WHERE network = ${network}
          GROUP BY DATE(block_ts)
          ORDER BY day ASC
        `,

      cutoff
        ? sql`
          SELECT
            DATE(block_ts) as day,
            COUNT(*) as deposit_count
          FROM deposits
          WHERE network = ${network} AND block_ts >= ${cutoff.toISOString()}
          GROUP BY DATE(block_ts)
          ORDER BY day ASC
        `
        : sql`
          SELECT
            DATE(block_ts) as day,
            COUNT(*) as deposit_count
          FROM deposits
          WHERE network = ${network}
          GROUP BY DATE(block_ts)
          ORDER BY day ASC
        `,
    ]);

    const dateMap = {};

    for (const row of tradesResult.rows) {
      const d = new Date(row.day).toISOString().split('T')[0];
      if (!dateMap[d]) dateMap[d] = { trades: 0, deposits: 0, volume: 0 };
      dateMap[d].trades = parseInt(row.trade_count);
      dateMap[d].volume = parseFloat(row.volume || 0);
    }

    for (const row of depositsResult.rows) {
      const d = new Date(row.day).toISOString().split('T')[0];
      if (!dateMap[d]) dateMap[d] = { trades: 0, deposits: 0, volume: 0 };
      dateMap[d].deposits = parseInt(row.deposit_count);
    }

    const dates = Object.keys(dateMap).sort();
    const activity = dates.map(d => ({
      date: d,
      trades: dateMap[d].trades,
      deposits: dateMap[d].deposits,
    }));
    const volumeByDay = dates.map(d => ({
      date: d,
      volume: dateMap[d].volume,
    }));

    res.status(200).json({ activity, volumeByDay });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Failed to fetch chart data', details: error.message });
  }
}
