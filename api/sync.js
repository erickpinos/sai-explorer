import { sql } from '../shared/db.js';
import { nibiToHex } from '../scripts/addressUtils.js';
import { fetchGraphQL } from '../shared/graphql.js';
import { getFailedTxHashes } from '../shared/evmReceipt.js';
import { checkRateLimit, SYNC_MAX } from '../shared/rateLimit.js';
import { requireAdminAccess } from '../shared/adminAuth.js';

async function syncTrades(network, { full = false } = {}) {
  console.log(`Syncing trades for ${network}...`);

  // Use keeper's sequential ID as watermark — immune to out-of-order block_ts insertions.
  // Fetch ascending (oldest first) starting just before lastId so a small overlap
  // catches any records the keeper registered late with an earlier block_ts.
  const BUFFER = 20;
  const PAGE_SIZE = 100;
  let newTradesCount = 0;

  let lastId = 0;
  if (!full) {
    const result = await sql`
      SELECT COALESCE(MAX(id::int), 0) AS max_id FROM trades WHERE network = ${network}
    `;
    lastId = parseInt(result.rows[0].max_id);
  }

  let offset = Math.max(0, lastId - BUFFER);
  // Keep fetching as long as the last page contained new records
  let maxOffset = offset + PAGE_SIZE;

  while (offset <= maxOffset) {
    const res = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: false) {
          id tradeChangeType realizedPnlPct realizedPnlCollateral
          txHash evmTxHash collateralPrice
          block { block block_ts }
          trade {
            id trader tradeType isLong isOpen leverage openPrice closePrice
            collateralAmount openCollateralAmount tp sl
            perpBorrowing { marketId baseToken { symbol } collateralToken { symbol } }
          }
        }
      }
    }`, network);

    const trades = res.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    // Insert all records in the fetch window — the buffer range may contain IDs
    // that are < lastId but were missing (e.g. late keeper registration). ON CONFLICT
    // handles already-existing records. Only extend the window for truly new IDs.
    const trulyNewTrades = trades.filter(t => t.id > lastId);

    if (trades.length > 0) {
      const failedHashes = await getFailedTxHashes(trades, network);
      const results = await Promise.allSettled(trades.map(t => sql`
        INSERT INTO trades (
          id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
          tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
          trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
          collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol,
          tx_failed
        ) VALUES (
          ${t.id}, ${network}, ${t.tradeChangeType}, ${t.realizedPnlPct}, ${t.realizedPnlCollateral},
          ${t.txHash}, ${t.evmTxHash}, ${t.collateralPrice}, ${t.block.block}, ${t.block.block_ts},
          ${t.trade.trader}, ${nibiToHex(t.trade.trader)}, ${t.trade.tradeType}, ${t.trade.isLong}, ${t.trade.isOpen},
          ${t.trade.leverage}, ${t.trade.openPrice}, ${t.trade.closePrice},
          ${t.trade.collateralAmount}, ${t.trade.openCollateralAmount}, ${t.trade.tp}, ${t.trade.sl},
          ${t.trade.perpBorrowing?.marketId}, ${t.trade.perpBorrowing?.baseToken?.symbol}, ${t.trade.perpBorrowing?.collateralToken?.symbol},
          ${failedHashes.has(t.evmTxHash)}
        )
        ON CONFLICT (id) DO UPDATE SET
          collateral_token_symbol = EXCLUDED.collateral_token_symbol,
          base_token_symbol = EXCLUDED.base_token_symbol,
          evm_trader = EXCLUDED.evm_trader,
          tx_failed = EXCLUDED.tx_failed,
          collateral_price = COALESCE(trades.collateral_price, EXCLUDED.collateral_price)
        WHERE trades.collateral_token_symbol IS NULL
          OR trades.base_token_symbol IS NULL
          OR trades.evm_trader IS NULL
          OR trades.tx_failed != EXCLUDED.tx_failed
          OR trades.collateral_price IS NULL
      `));
      newTradesCount += results.filter(r => r.status === 'fulfilled').length;
      const tradeFailures = results.filter(r => r.status === 'rejected');
      if (tradeFailures.length > 0) {
        console.error(`[sync] ${tradeFailures.length} trade inserts failed at offset ${offset}:`, tradeFailures.map(f => f.reason?.message));
      }
    }

    if (trulyNewTrades.length > 0) {
      // Extend the search window — there may be more pages ahead
      maxOffset = offset + PAGE_SIZE;
      console.log(`Found ${trulyNewTrades.length} new trades at offset ${offset} (ids ${Math.min(...trulyNewTrades.map(t=>t.id))}–${Math.max(...trulyNewTrades.map(t=>t.id))})`);
    }

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newTradesCount} new trades for ${network}`);
  return newTradesCount;
}

// After each sync, check the last GAP_WINDOW IDs for holes and fetch any missing ones.
// IDs are sequential so offset = id - 1 maps directly to the GraphQL position.
async function fillTradeGaps(network) {
  const GAP_WINDOW = 200;

  const gapResult = await sql`
    WITH bounds AS (
      SELECT GREATEST(1, MAX(id::int) - ${GAP_WINDOW}) AS lo, MAX(id::int) AS hi
      FROM trades WHERE network = ${network}
    )
    SELECT s.id
    FROM bounds, generate_series(bounds.lo, bounds.hi) s(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM trades WHERE network = ${network} AND id::int = s.id
    )
    ORDER BY s.id
  `;

  const gapIds = gapResult.rows.map(r => parseInt(r.id));
  if (gapIds.length === 0) return 0;

  console.log(`Found ${gapIds.length} gap IDs for ${network}: ${gapIds.join(', ')}`);

  let filled = 0;
  for (const gapId of gapIds) {
    const res = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: 1, offset: ${gapId - 1}, order_desc: false) {
          id tradeChangeType realizedPnlPct realizedPnlCollateral
          txHash evmTxHash collateralPrice
          block { block block_ts }
          trade {
            id trader tradeType isLong isOpen leverage openPrice closePrice
            collateralAmount openCollateralAmount tp sl
            perpBorrowing { marketId baseToken { symbol } collateralToken { symbol } }
          }
        }
      }
    }`, network);

    const trades = res.data?.perp?.tradeHistory || [];
    const t = trades[0];
    if (!t || t.id !== gapId) {
      console.log(`Gap ID ${gapId} not yet in GraphQL — skipping`);
      continue;
    }

    const failedHashes = await getFailedTxHashes([t], network);
    await sql`
      INSERT INTO trades (
        id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
        tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
        trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
        collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol,
        tx_failed
      ) VALUES (
        ${t.id}, ${network}, ${t.tradeChangeType}, ${t.realizedPnlPct}, ${t.realizedPnlCollateral},
        ${t.txHash}, ${t.evmTxHash}, ${t.collateralPrice}, ${t.block.block}, ${t.block.block_ts},
        ${t.trade.trader}, ${nibiToHex(t.trade.trader)}, ${t.trade.tradeType}, ${t.trade.isLong}, ${t.trade.isOpen},
        ${t.trade.leverage}, ${t.trade.openPrice}, ${t.trade.closePrice},
        ${t.trade.collateralAmount}, ${t.trade.openCollateralAmount}, ${t.trade.tp}, ${t.trade.sl},
        ${t.trade.perpBorrowing?.marketId}, ${t.trade.perpBorrowing?.baseToken?.symbol}, ${t.trade.perpBorrowing?.collateralToken?.symbol},
        ${failedHashes.has(t.evmTxHash)}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`Filled gap ID ${gapId} for ${network}`);
    filled++;
  }

  return filled;
}

async function backfillTradeSymbols(network) {
  const missing = await sql`
    SELECT COUNT(*) as cnt FROM trades
    WHERE network = ${network} AND collateral_token_symbol IS NULL
  `;

  const missingCount = parseInt(missing.rows[0].cnt);
  if (missingCount === 0) return 0;

  const metaKey = `backfill_done_${network}`;
  const meta = await sql`SELECT value FROM metadata WHERE key = ${metaKey}`;
  const lastBackfillCount = parseInt(meta.rows[0]?.value || '0');
  if (lastBackfillCount > 0 && lastBackfillCount === missingCount) {
    return 0;
  }

  console.log(`Backfilling ${missingCount} trades missing collateral_token_symbol for ${network}...`);

  const PAGE_SIZE = 100;
  let offset = 0;
  let updatedCount = 0;
  const MAX_PAGES = 50;

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const res = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: true) {
          id
          trade {
            trader
            perpBorrowing { marketId baseToken { symbol } collateralToken { symbol } }
          }
        }
      }
    }`, network);

    const trades = res.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    const updates = trades
      .map(t => ({
        id: t.id,
        symbol: t.trade?.perpBorrowing?.collateralToken?.symbol,
        baseSymbol: t.trade?.perpBorrowing?.baseToken?.symbol,
        evmTrader: nibiToHex(t.trade?.trader),
      }))
      .filter(u => u.symbol || u.baseSymbol || u.evmTrader);

    if (updates.length > 0) {
      const results = await Promise.allSettled(updates.map(u => sql`
        UPDATE trades SET
          collateral_token_symbol = COALESCE(trades.collateral_token_symbol, ${u.symbol}),
          base_token_symbol = COALESCE(trades.base_token_symbol, ${u.baseSymbol}),
          evm_trader = COALESCE(trades.evm_trader, ${u.evmTrader})
        WHERE id = ${u.id} AND network = ${network}
          AND (collateral_token_symbol IS NULL OR base_token_symbol IS NULL OR evm_trader IS NULL)
      `));
      updatedCount += results.filter(r => r.status === 'fulfilled' && r.value.rowCount > 0).length;
    }

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const remainingMissing = await sql`
    SELECT COUNT(*) as cnt FROM trades
    WHERE network = ${network} AND collateral_token_symbol IS NULL
  `;
  const remainingCount = parseInt(remainingMissing.rows[0].cnt);
  await sql`
    INSERT INTO metadata (key, value, updated_at) VALUES (${metaKey}, ${String(remainingCount)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${String(remainingCount)}, updated_at = NOW()
  `;

  console.log(`Backfilled ${updatedCount} trades for ${network} (${remainingCount} still missing)`);
  return updatedCount;
}

async function syncDeposits(network, { full = false } = {}) {
  console.log(`Syncing deposits for ${network}...`);

  // Per-vault checkpoints: only skip deposits already stored for each specific vault.
  // A global checkpoint silently misses early deposits from vaults added after the last backfill.
  const { rows: vaultTs } = await sql`
    SELECT vault_address, MAX(block_ts) AS latest_ts
    FROM deposits
    WHERE network = ${network} AND vault_address IS NOT NULL
    GROUP BY vault_address
  `;
  const vaultCheckpoints = new Map(vaultTs.map(r => [r.vault_address, new Date(r.latest_ts)]));

  const PAGE_SIZE = 100;
  let offset = 0;
  let newDepositsCount = 0;
  const MAX_PAGES = 50; // Large enough to reach old deposits for newly-added vaults

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const res = await fetchGraphQL(`{
      lp {
        depositHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: true) {
          id depositor amount shares txHash evmTxHash
          block { block block_ts }
          vault { address collateralToken { symbol } tvl }
        }
      }
    }`, network);

    const deposits = res.data?.lp?.depositHistory || [];
    if (deposits.length === 0) break;

    const batch = [];
    // allStale = true when every deposit in the page is older than its vault's checkpoint.
    // Once true, deeper pages (older) can't have anything new either.
    let allStale = true;

    for (const d of deposits) {
      const checkpoint = vaultCheckpoints.get(d.vault?.address);
      const depositTs = new Date(d.block.block_ts);
      if (checkpoint === undefined || depositTs > checkpoint) {
        // New vault (no checkpoint yet) OR deposit is newer than vault's checkpoint
        batch.push(d);
        allStale = false;
      }
    }

    if (batch.length > 0) {
      const results = await Promise.allSettled(batch.map(d => sql`
        INSERT INTO deposits (
          network, depositor, evm_depositor, amount, shares,
          block_height, block_ts, tx_hash, evm_tx_hash,
          vault_address, collateral_token_symbol, vault_tvl
        ) VALUES (
          ${network}, ${d.depositor}, ${nibiToHex(d.depositor)}, ${d.amount}, ${d.shares},
          ${d.block.block}, ${d.block.block_ts}, ${d.txHash}, ${d.evmTxHash},
          ${d.vault.address}, ${d.vault.collateralToken.symbol}, ${d.vault.tvl}
        )
        ON CONFLICT (network, depositor, block_ts, amount) DO UPDATE SET
          evm_depositor = COALESCE(deposits.evm_depositor, EXCLUDED.evm_depositor)
        WHERE deposits.evm_depositor IS NULL
      `));
      newDepositsCount += results.filter(r => r.status === 'fulfilled' && r.value?.rowCount > 0).length;
    }

    if (allStale) {
      console.log(`All deposits in page are stale for their vaults, stopping`);
      break;
    }
    if (deposits.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newDepositsCount} new deposits for ${network}`);
  return newDepositsCount;
}

async function syncWithdraws(network, { full: _full = false } = {}) {
  console.log(`Syncing withdraws for ${network}...`);

  const PAGE_SIZE = 100;
  let offset = 0;
  let newWithdrawsCount = 0;
  const MAX_PAGES = 10;

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const res = await fetchGraphQL(`{
      lp {
        withdrawRequests(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: true) {
          depositor shares unlockEpoch autoRedeem
          vault { address collateralToken { symbol } }
        }
      }
    }`, network);

    const withdraws = res.data?.lp?.withdrawRequests || [];
    if (withdraws.length === 0) break;

    const results = await Promise.allSettled(withdraws.map(w => sql`
      INSERT INTO withdraws (
        network, depositor, evm_depositor, shares, unlock_epoch, auto_redeem,
        vault_address, collateral_token_symbol
      ) VALUES (
        ${network}, ${w.depositor}, ${nibiToHex(w.depositor)}, ${w.shares}, ${w.unlockEpoch}, ${w.autoRedeem},
        ${w.vault.address}, ${w.vault.collateralToken.symbol}
      )
      ON CONFLICT (network, depositor, vault_address, shares, unlock_epoch) DO UPDATE SET
        evm_depositor = COALESCE(withdraws.evm_depositor, EXCLUDED.evm_depositor)
      WHERE withdraws.evm_depositor IS NULL
    `));
    newWithdrawsCount += results.filter(r => r.status === 'fulfilled' && r.value?.rowCount > 0).length;

    if (withdraws.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newWithdrawsCount} new withdraws for ${network}`);
  return newWithdrawsCount;
}

async function syncVaultSharePrices(network) {
  // Only snapshot once per day, at or after 8am UTC
  if (new Date().getUTCHours() !== 0) return 0; // 8pm EDT = 00:00 UTC

  const { rows: existing } = await sql`
    SELECT 1 FROM vault_share_prices
    WHERE network = ${network}
      AND recorded_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
      AND recorded_at <  DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`Vault share prices already snapshotted today for ${network}, skipping`);
    return 0;
  }

  const res = await fetchGraphQL(`{
    lp {
      vaults {
        address
        sharePrice
      }
    }
  }`, network);
  const vaults = res.data?.lp?.vaults || [];
  const now = new Date().toISOString();
  let count = 0;
  for (const v of vaults) {
    if (!v.address || v.sharePrice == null) continue;
    const result = await sql`
      INSERT INTO vault_share_prices (network, vault_address, share_price, recorded_at, source)
      VALUES (${network}, ${v.address}, ${v.sharePrice}, ${now}, 'sync')
      ON CONFLICT DO NOTHING
    `;
    count += result.rowCount || 0;
  }
  console.log(`Snapshotted ${count} vault share prices for ${network}`);
  return count;
}

export default async function handler(req, res) {
  if (!requireAdminAccess(req, res)) return;
  if (!checkRateLimit(req, res, SYNC_MAX)) return;

  try {
    const startTime = Date.now();
    const { network, table, full } = req.body || {};
    const opts = { full: full === true };

    // Sync both networks when no specific network requested (e.g. cron), else sync the specified one
    const networks = !network || network === 'all' ? ['mainnet', 'testnet'] : [network];

    const allResults = await Promise.all(
      networks.map(async (net) => {
        let trades = 0, deposits = 0, withdraws = 0;
        if (!table || table === 'trades')    trades    = await syncTrades(net, opts);
        if (!table || table === 'deposits')  deposits  = await syncDeposits(net, opts);
        if (!table || table === 'withdraws') withdraws = await syncWithdraws(net, opts);
        const backfilled = (!table || table === 'trades') ? await backfillTradeSymbols(net) : 0;
        const gaps = (!table || table === 'trades') ? await fillTradeGaps(net) : 0;
        const vaultPrices = await syncVaultSharePrices(net);
        return { network: net, trades, deposits, withdraws, backfilled, gaps, vaultPrices };
      })
    );

    const duration = Date.now() - startTime;

    const results = {
      success: true,
      synced_at: new Date().toISOString(),
      duration_ms: duration,
      mainnet: allResults.find(r => r.network === 'mainnet') || { trades: 0, deposits: 0, withdraws: 0 },
      testnet: allResults.find(r => r.network === 'testnet') || { trades: 0, deposits: 0, withdraws: 0 }
    };

    // For single-network requests, also include flat format for frontend compatibility
    if (network && network !== 'all') {
      const single = allResults[0];
      results.network = network;
      results.trades = single.trades;
      results.deposits = single.deposits;
      results.withdraws = single.withdraws;
    }

    console.log('Sync completed:', results);
    res.status(200).json(results);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed'
    });
  }
}

export const config = {
  maxDuration: 60  // 60 seconds for Pro plan, 10s for Hobby
};
