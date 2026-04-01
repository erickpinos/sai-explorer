import { query, pool } from './db.js';
import { fetchGraphQL } from '../shared/graphql.js';

const NETWORK = 'testnet';
const PAGE_SIZE = 100;

async function fetchAllKeeperTrades() {
  const keeperMap = new Map();
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

  console.log(`Fetched ${keeperMap.size} trades from testnet keeper (${page} pages)\n`);
  return keeperMap;
}

async function run() {
  console.log('=== Backfill Testnet Keeper IDs ===\n');

  console.log('Fetching keeper trades...');
  const keeperMap = await fetchAllKeeperTrades();

  console.log('Fetching DB trades...');
  const dbResult = await query(`SELECT id, tx_hash, trade_change_type FROM trades WHERE network = $1`, [NETWORK]);
  const dbTrades = dbResult.rows;
  console.log(`Found ${dbTrades.length} trades in DB\n`);

  let matched = 0;
  let noMatch = 0;

  for (const row of dbTrades) {
    const key = `${row.tx_hash}|${row.trade_change_type}`;
    const keeperId = keeperMap.get(key);
    if (keeperId != null) {
      await query(`UPDATE trades SET keeper_id = $1 WHERE id = $2`, [keeperId, row.id]);
      matched++;
      keeperMap.delete(key);
    } else {
      noMatch++;
    }
  }

  console.log('=== RESULTS ===\n');
  console.log(`Matched & updated:  ${matched}`);
  console.log(`DB trades with no keeper match:  ${noMatch}`);
  console.log(`Keeper trades with no DB match:  ${keeperMap.size}\n`);

  pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
