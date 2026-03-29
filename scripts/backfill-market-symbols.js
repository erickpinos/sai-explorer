import { query, pool } from './db.js';

const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://sai-keeper.testnet-2.nibiru.fi/query',
};

async function fetchGraphQL(q, network = 'mainnet') {
  const endpoint = GRAPHQL_ENDPOINTS[network];
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const DELAY_MS = 200; // stagger between keeper queries
const PAGE_SIZE = 100;

async function backfill(network) {
  // Step 1: Clear all base_token_symbol values
  console.log(`\nClearing all base_token_symbol for ${network}...`);
  await query('UPDATE trades SET base_token_symbol = NULL WHERE network = $1', [network]);
  console.log('✓ Cleared');

  // Step 2: Get total trade count and max ID
  const { rows: [{ count, max_id }] } = await query(
    'SELECT COUNT(*)::int AS count, COALESCE(MAX(id::int), 0) AS max_id FROM trades WHERE network = $1',
    [network]
  );
  console.log(`${count} trades to backfill (max ID: ${max_id})`);
  if (count === 0) return;

  // Step 3: Fetch trades from keeper in pages (ascending by ID) and update DB
  let offset = 0;
  let updated = 0;
  let notFound = 0;

  while (true) {
    const res = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: false) {
          id
          trade {
            id
            perpBorrowing { marketId baseToken { symbol } }
          }
        }
      }
    }`, network);

    const trades = res.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    for (const t of trades) {
      const symbol = t.trade?.perpBorrowing?.baseToken?.symbol;
      const tradePositionId = t.trade?.id != null ? parseInt(t.trade.id) : null;

      if (!symbol && tradePositionId == null) {
        notFound++;
        continue;
      }

      const result = await query(
        `UPDATE trades SET
          base_token_symbol = COALESCE($1, base_token_symbol),
          trade_position_id = COALESCE($4, trade_position_id)
        WHERE id = $2 AND network = $3`,
        [symbol || null, t.id, network, tradePositionId]
      );
      if (result.rowCount > 0) updated++;
      if (!symbol) notFound++;
    }

    const highestId = trades[trades.length - 1]?.id;
    console.log(`  offset ${offset}: fetched ${trades.length} trades (up to ID ${highestId}), ${updated} updated so far`);

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(DELAY_MS);
  }

  // Step 4: Report results
  const { rows: [{ still_null }] } = await query(
    'SELECT COUNT(*)::int AS still_null FROM trades WHERE network = $1 AND base_token_symbol IS NULL',
    [network]
  );

  console.log(`\n✓ ${network} backfill complete:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Keeper returned no symbol: ${notFound}`);
  console.log(`  Still NULL in DB: ${still_null}`);
}

async function main() {
  const network = process.argv[2] || 'mainnet';
  console.log(`Backfilling market symbols from keeper for ${network}`);
  console.log(`Stagger delay: ${DELAY_MS}ms between pages\n`);

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
