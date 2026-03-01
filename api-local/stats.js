import { pool } from '../scripts/db.js';
import { ACTIVE_VAULTS, EXCLUDED_TRADE_TYPES_SQL } from '../shared/constants.js';
import { fetchGraphQL } from '../shared/graphql.js';
import { buildPriceMap } from '../shared/buildPriceMap.js';

async function fetchLiveTvl(network) {
  const [vaultsRes, pricesRes] = await Promise.all([
    fetchGraphQL('{ lp { vaults { sharesERC20 availableAssets collateralToken { symbol } } } }', network),
    fetchGraphQL('{ oracle { tokenPricesUsd { token { symbol } priceUsd } } }', network),
  ]);
  const prices = buildPriceMap(pricesRes.data?.oracle?.tokenPricesUsd);
  return (vaultsRes.data?.lp?.vaults || [])
    .filter(v => ACTIVE_VAULTS.has(v.sharesERC20 || ''))
    .reduce((sum, v) => {
      const token = (v.collateralToken?.symbol || '').toUpperCase();
      return sum + (v.availableAssets / 1e6) * (prices[token] ?? 1);
    }, 0);
}

export default async function handler(req, res) {
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

    const [tradesStats, depositsStats, uniqueTraders, recentTrades, withdrawsStats, liveTvl] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_trades,
          SUM(ABS(collateral_amount * leverage / 1000000 * COALESCE(collateral_price, 1))) as total_volume
        FROM trades
        WHERE network = $1
          AND trade_change_type NOT IN (${EXCLUDED_TRADE_TYPES_SQL})
      `, [network]),

      pool.query(`
        SELECT
          COUNT(*) as total_deposits,
          SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_deposited
        FROM deposits
        WHERE network = $1
      `, [network]),

      pool.query(`
        SELECT COUNT(DISTINCT trader) as unique_traders
        FROM trades
        WHERE network = $1
      `, [network]),

      pool.query(`
        SELECT block_ts
        FROM trades
        WHERE network = $1
        ORDER BY block_ts DESC
        LIMIT 1
      `, [network]),

      pool.query(`
        SELECT COUNT(*) as total_withdraws
        FROM withdraws
        WHERE network = $1
      `, [network]),

      fetchLiveTvl(network),
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
      withdraws: {
        total: parseInt(withdrawsStats.rows[0]?.total_withdraws || 0)
      },
      traders: {
        unique: parseInt(uniqueTraders.rows[0]?.unique_traders || 0)
      },
      tvl: liveTvl,
      lastUpdated: recentTrades.rows[0]?.block_ts || null
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}
