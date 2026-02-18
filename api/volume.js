import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { network = 'mainnet' } = req.query;

    const result = await sql`
      SELECT
        trader,
        evm_trader,
        COUNT(*) as trade_count,
        SUM(CASE WHEN trade_change_type = 'position_opened'
            THEN ABS(collateral_amount * leverage / 1000000)
            ELSE 0 END) as total_volume,
        SUM(COALESCE(realized_pnl_collateral, 0) / 1000000) as realized_pnl,
        COUNT(CASE WHEN trade_change_type = 'position_opened' THEN 1 END) as opens,
        COUNT(CASE WHEN trade_change_type LIKE 'position_closed%' THEN 1 END) as closes,
        COUNT(CASE WHEN trade_change_type = 'position_liquidated' THEN 1 END) as liquidations
      FROM trades
      WHERE network = ${network}
      GROUP BY trader, evm_trader
      ORDER BY total_volume DESC
    `;

    const users = result.rows.map(r => ({
      trader: r.trader,
      evmTrader: r.evm_trader,
      tradeCount: parseInt(r.trade_count),
      totalVolume: parseFloat(r.total_volume || 0),
      realizedPnl: parseFloat(r.realized_pnl || 0),
      opens: parseInt(r.opens),
      closes: parseInt(r.closes),
      liquidations: parseInt(r.liquidations),
    }));

    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching volume by user:', error);
    res.status(500).json({ error: 'Failed to fetch volume data', details: error.message });
  }
}
