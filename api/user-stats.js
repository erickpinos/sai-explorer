import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { network = 'mainnet', address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Address parameter required' });
    }

    const tradesResult = await sql`
      SELECT
        COUNT(*) as total_trades,
        SUM(collateral_amount * leverage / 1000000 * COALESCE(collateral_price, 1)) as total_volume,
        SUM(realized_pnl_collateral / 1000000 * COALESCE(collateral_price, 1)) as realized_pnl
      FROM trades
      WHERE network = ${network}
        AND (trader = ${address} OR evm_trader = ${address})
        AND trade_change_type NOT IN ('tp_updated', 'sl_updated', 'limit_order_created', 'limit_order_cancelled', 'stop_order_created', 'stop_order_cancelled')
    `;

    const depositsResult = await sql`
      SELECT COUNT(*) as total_deposits
      FROM deposits
      WHERE network = ${network} AND depositor = ${address}
    `;

    const stats = {
      tradeCount: parseInt(tradesResult.rows[0].total_trades) || 0,
      totalVolume: parseFloat(tradesResult.rows[0].total_volume) || 0,
      realizedPnl: parseFloat(tradesResult.rows[0].realized_pnl) || 0,
      lpDepositsCount: parseInt(depositsResult.rows[0].total_deposits) || 0
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats', details: error.message });
  }
}
