import { query, pool } from './db.js';

const API_BASE = {
  mainnet: 'https://sai-explorer.vercel.app',
  testnet: 'https://sai-explorer.vercel.app',
};

async function backfill(network) {
  // Step 1: Fetch market map from /api/markets (same source as Markets table)
  const base = process.env.API_BASE || API_BASE[network] || API_BASE.mainnet;
  const url = `${base}/api/markets?network=${network}`;
  console.log(`Fetching markets from ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Markets API returned ${res.status}`);
  const { markets } = await res.json();

  const symbolMap = {};
  for (const m of markets) {
    if (m.marketId != null && m.baseToken?.symbol) {
      symbolMap[m.marketId] = m.baseToken.symbol;
    }
  }

  const entries = Object.entries(symbolMap);
  console.log(`Found ${entries.length} markets`);
  console.log(entries.map(([id, s]) => `${id}=${s}`).join(', '));

  if (entries.length === 0) {
    console.error('No markets found — aborting.');
    process.exit(1);
  }

  // Step 2: Clear all base_token_symbol values
  console.log(`\nClearing all base_token_symbol for ${network}...`);
  await query('UPDATE trades SET base_token_symbol = NULL WHERE network = $1', [network]);
  console.log('Cleared');

  // Step 3: Update trades by market_id
  let totalUpdated = 0;
  for (const [marketId, symbol] of entries) {
    const result = await query(
      `UPDATE trades SET base_token_symbol = $1
       WHERE market_id = $2 AND network = $3`,
      [symbol, marketId, network]
    );
    if (result.rowCount > 0) {
      console.log(`  market ${marketId} (${symbol}): ${result.rowCount} trades updated`);
      totalUpdated += result.rowCount;
    }
  }

  // Step 4: Report
  const { rows: [{ total, still_null }] } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE base_token_symbol IS NULL)::int AS still_null
     FROM trades WHERE network = $1`,
    [network]
  );

  console.log(`\nDone: ${totalUpdated}/${total} trades updated, ${still_null} still NULL`);
}

async function main() {
  const network = process.argv[2] || 'mainnet';
  console.log(`Backfilling market symbols from /api/markets for ${network}\n`);

  try {
    await backfill(network);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
