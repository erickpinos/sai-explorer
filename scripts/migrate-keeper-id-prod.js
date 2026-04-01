/**
 * Production migration: switch from history ID to keeper_id for trade dedup.
 *
 * Batches updates for speed (was doing 1 query per row = 15+ min on Neon).
 * Handles duplicate keeper_ids gracefully.
 */

import { query, pool } from './db.js';
import { fetchGraphQL } from '../shared/graphql.js';

const PAGE_SIZE = 100;

async function fetchAllKeeperTrades(network) {
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
    }`, network);

    const trades = gqlRes.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    for (const t of trades) {
      const key = `${t.txHash}|${t.tradeChangeType}`;
      keeperMap.set(key, t.id);
    }

    page++;
    if (page % 10 === 0) console.log(`  [${network}] fetched ${page} pages (${keeperMap.size} trades)...`);
    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`  [${network}] Fetched ${keeperMap.size} trades from keeper (${page} pages)`);
  return keeperMap;
}

async function backfillNetwork(network) {
  console.log(`\n=== Backfill ${network} keeper_ids ===`);

  // Skip if already fully backfilled
  const check = await query(
    `SELECT COUNT(*) FILTER (WHERE keeper_id IS NULL) as missing FROM trades WHERE network = $1`,
    [network]
  );
  if (parseInt(check.rows[0].missing) === 0) {
    console.log(`  [${network}] Already fully backfilled, skipping`);
    return;
  }

  const keeperMap = await fetchAllKeeperTrades(network);

  const dbResult = await query(
    `SELECT id, tx_hash, trade_change_type FROM trades WHERE network = $1 AND keeper_id IS NULL`,
    [network]
  );
  console.log(`  [${network}] ${dbResult.rows.length} trades need keeper_id`);

  // Build batch: group updates by keeper_id
  const updates = []; // [{id, keeperId}]
  const noMatch = [];

  for (const row of dbResult.rows) {
    const key = `${row.tx_hash}|${row.trade_change_type}`;
    const keeperId = keeperMap.get(key);
    if (keeperId != null) {
      updates.push({ id: row.id, keeperId });
      keeperMap.delete(key);
    } else {
      noMatch.push(row.id);
    }
  }

  // Batch update using unnest — single query instead of N queries
  if (updates.length > 0) {
    const BATCH = 500;
    let updated = 0;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      const ids = batch.map(u => u.id);
      const keeperIds = batch.map(u => u.keeperId);
      try {
        const res = await query(
          `UPDATE trades SET keeper_id = data.kid::int
           FROM (SELECT unnest($1::text[]) as tid, unnest($2::int[]) as kid) data
           WHERE trades.id = data.tid`,
          [ids, keeperIds]
        );
        updated += res.rowCount;
      } catch (err) {
        if (err.code === '23505') {
          // Duplicate — fall back to individual updates, skipping dupes
          console.log(`  [${network}] Batch hit duplicate, falling back to individual for this batch`);
          for (const u of batch) {
            try {
              await query(`UPDATE trades SET keeper_id = $1 WHERE id = $2`, [u.keeperId, u.id]);
              updated++;
            } catch (e) {
              if (e.code === '23505') {
                console.log(`  [${network}] Duplicate keeper_id=${u.keeperId} for id=${u.id}, marking for deletion`);
                noMatch.push(u.id);
              } else throw e;
            }
          }
        } else throw err;
      }
      console.log(`  [${network}] Updated ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
    }
    console.log(`  [${network}] Backfilled ${updated} keeper_ids`);
  }

  console.log(`  [${network}] No keeper match (will delete): ${noMatch.length}`);

  // Delete unmatched trades (failed/reverted txs + duplicates)
  if (noMatch.length > 0) {
    for (let i = 0; i < noMatch.length; i += 500) {
      const batch = noMatch.slice(i, i + 500);
      await query(`DELETE FROM trades WHERE id = ANY($1) AND network = $2`, [batch, network]);
    }
    console.log(`  [${network}] Deleted ${noMatch.length} orphan/duplicate trades`);
  }
}

async function run() {
  console.log('=== Production Migration: keeper_id dedup ===\n');

  // Step 0: Ensure keeper_id column exists
  await query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS keeper_id INTEGER');
  console.log('keeper_id column ready');

  // Step 1: Ensure constraint exists (idempotent)
  try {
    await query('ALTER TABLE trades ADD CONSTRAINT uq_trades_network_keeper_id UNIQUE (network, keeper_id)');
    console.log('Added constraint uq_trades_network_keeper_id');
  } catch (err) {
    if (err.code === '42710' || err.message?.includes('already exists')) console.log('Constraint uq_trades_network_keeper_id already exists');
    else throw err;
  }

  // Step 2: Backfill both networks
  await backfillNetwork('mainnet');
  await backfillNetwork('testnet');

  // Step 3: Delete _k duplicates where a non-_k row has the same keeper_id
  console.log('\n=== Clean up _k duplicates ===');
  const dups = await query(`
    SELECT a.id as k_id, b.id as orig_id, a.keeper_id
    FROM trades a
    JOIN trades b ON a.keeper_id = b.keeper_id AND a.network = b.network AND a.id != b.id
    WHERE a.id LIKE '_k%' AND b.id NOT LIKE '_k%'
  `);
  if (dups.rows.length > 0) {
    const origIds = dups.rows.map(r => r.orig_id);
    await query(`DELETE FROM trades WHERE id = ANY($1)`, [origIds]);
    console.log(`Deleted ${origIds.length} original rows duplicated by _k rows`);
  } else {
    console.log('No _k duplicates');
  }

  // Step 4: Set id default
  await query(`ALTER TABLE trades ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`);
  console.log('Set id default to gen_random_uuid()');

  // Final stats
  console.log('\n=== Final stats ===');
  const stats = await query(`
    SELECT network,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE keeper_id IS NOT NULL) as has_keeper,
      COUNT(*) FILTER (WHERE keeper_id IS NULL) as no_keeper
    FROM trades GROUP BY network ORDER BY network
  `);
  for (const row of stats.rows) {
    console.log(`[${row.network}] ${row.total} total, ${row.has_keeper} with keeper_id, ${row.no_keeper} without`);
  }

  console.log('\n✅ Migration complete!');
  pool.end();
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  pool.end();
  process.exit(1);
});
