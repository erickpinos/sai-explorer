import { query, pool } from './db.js';
import { fetchGraphQL } from '../shared/graphql.js';

const NETWORK = 'mainnet';
const PAGE_SIZE = 100;

async function fetchAllKeeperTrades() {
  const keeperMap = new Map(); // "tx_hash|tradeChangeType" -> keeper id
  let offset = 0;
  let page = 0;

  while (true) {
    const gqlRes = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: false) {
          id
          txHash
          tradeChangeType
        }
      }
    }`, NETWORK);

    const trades = gqlRes.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    for (const t of trades) {
      const key = `${t.txHash}|${t.tradeChangeType}`;
      if (keeperMap.has(key)) {
        console.warn(`  ⚠ duplicate key in keeper: ${key} (ids ${keeperMap.get(key)} and ${t.id})`);
      }
      keeperMap.set(key, t.id);
    }

    page++;
    if (page % 10 === 0) {
      console.log(`  fetched ${page} pages (${keeperMap.size} trades)...`);
    }

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`Fetched ${keeperMap.size} trades from keeper (${page} pages)\n`);
  return keeperMap;
}

async function run() {
  console.log('=== Backfill Keeper IDs ===\n');

  // 1. Fetch all keeper trades
  console.log('Fetching keeper trades...');
  const keeperMap = await fetchAllKeeperTrades();

  // 2. Fetch all DB trades
  console.log('Fetching DB trades...');
  const dbResult = await query(`SELECT id, tx_hash, trade_change_type FROM trades WHERE network = $1`, [NETWORK]);
  const dbTrades = dbResult.rows;
  console.log(`Found ${dbTrades.length} trades in DB\n`);

  // 3. Match and update
  let matched = 0;
  let noMatch = 0;
  const unmatchedDb = [];

  for (const row of dbTrades) {
    const key = `${row.tx_hash}|${row.trade_change_type}`;
    const keeperId = keeperMap.get(key);
    if (keeperId != null) {
      await query(`UPDATE trades SET keeper_id = $1 WHERE id = $2`, [keeperId, row.id]);
      matched++;
      keeperMap.delete(key); // remove matched entries
    } else {
      noMatch++;
      unmatchedDb.push(row);
    }
  }

  // 4. Report
  console.log('=== RESULTS ===\n');
  console.log(`Matched & updated:  ${matched}`);
  console.log(`DB trades with no keeper match:  ${noMatch}`);
  console.log(`Keeper trades with no DB match:  ${keeperMap.size}\n`);

  if (unmatchedDb.length > 0) {
    console.log('--- DB trades NOT in keeper ---');
    for (const row of unmatchedDb) {
      console.log(`  id=${row.id}  tx_hash=${row.tx_hash}`);
    }
    console.log();
  }

  if (keeperMap.size > 0) {
    console.log('--- Keeper trades NOT in DB (MISSING) ---');
    for (const [txHash, keeperId] of keeperMap) {
      console.log(`  keeper_id=${keeperId}  tx_hash=${txHash}`);
    }
    console.log();
  }

  pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
