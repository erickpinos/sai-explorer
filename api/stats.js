import { sql } from '@vercel/postgres';

const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://sai-keeper.testnet-2.nibiru.fi/query'
};
const ACTIVE_VAULTS = new Set([
  '0xE96397b6135240956413031c0B26507eeCCD4B39',
  '0x7275AfFf575aD79da8b245784cE54a203Df954e6',
]);

async function fetchLiveTvl(network) {
  const endpoint = GRAPHQL_ENDPOINTS[network] || GRAPHQL_ENDPOINTS.mainnet;
  const [vaultsRes, pricesRes] = await Promise.all([
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ lp { vaults { sharesERC20 availableAssets collateralToken { symbol } } } }' }) }).then(r => r.json()),
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ oracle { tokenPricesUsd { token { symbol } priceUsd } } }' }) }).then(r => r.json()),
  ]);
  const prices = {};
  for (const p of pricesRes.data?.oracle?.tokenPricesUsd || []) {
    if (p.token?.symbol) prices[p.token.symbol.toUpperCase()] = parseFloat(p.priceUsd);
  }
  return (vaultsRes.data?.lp?.vaults || [])
    .filter(v => ACTIVE_VAULTS.has(v.sharesERC20 || ''))
    .reduce((sum, v) => {
      const token = (v.collateralToken?.symbol || '').toUpperCase();
      return sum + (v.availableAssets / 1e6) * (prices[token] ?? 1);
    }, 0);
}

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
    const [tradesStats, depositsStats, uniqueTraders, recentTrades, withdrawsStats, liveTvl] = await Promise.all([
      // Total trades count and volume
      sql`
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN collateral_amount IS NOT NULL AND leverage IS NOT NULL
              THEN ABS(collateral_amount * leverage / 1000000 * COALESCE(collateral_price, 1))
              ELSE 0 END) as total_volume
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
      `,

      // Total withdraws count
      sql`
        SELECT COUNT(*) as total_withdraws
        FROM withdraws
        WHERE network = ${network}
      `,

      fetchLiveTvl(network)
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
