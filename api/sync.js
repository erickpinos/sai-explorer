import { sql } from '../shared/db.js';
import { nibiToHex } from '../scripts/addressUtils.js';
import { fetchGraphQL } from '../shared/graphql.js';
import { getFailedTxHashes } from '../shared/evmReceipt.js';
import { checkRateLimit, SYNC_MAX } from '../shared/rateLimit.js';

async function syncTrades(network, { full = false } = {}) {
  console.log(`Syncing trades for ${network}...`);

  let sinceDate = null;
  if (!full) {
    // Get most recent trade timestamp from DB
    const lastTrade = await sql`
      SELECT block_ts FROM trades
      WHERE network = ${network}
      ORDER BY block_ts DESC
      LIMIT 1
    `;
    const sinceTimestamp = lastTrade.rows[0]?.block_ts;
    sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;
  }

  // Fetch new trades from blockchain API
  const PAGE_SIZE = 100;
  let offset = 0;
  let newTradesCount = 0;
  const MAX_PAGES = 10;

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const res = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: true) {
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

    // Collect new trades, stop at old data
    const batch = [];
    let reachedOld = false;
    for (const t of trades) {
      if (sinceDate && new Date(t.block.block_ts) <= sinceDate) {
        console.log(`Reached old trades at ${t.block.block_ts}, stopping`);
        reachedOld = true;
        break;
      }
      batch.push(t);
    }

    // Insert batch concurrently
    if (batch.length > 0) {
      const failedHashes = await getFailedTxHashes(batch, network);
      const results = await Promise.allSettled(batch.map(t => sql`
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
          tx_failed = EXCLUDED.tx_failed
        WHERE trades.collateral_token_symbol IS NULL
          OR trades.base_token_symbol IS NULL
          OR trades.evm_trader IS NULL
          OR trades.tx_failed != EXCLUDED.tx_failed
      `));
      newTradesCount += results.filter(r => r.status === 'fulfilled').length;
    }

    if (reachedOld) break;
    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newTradesCount} new trades for ${network}`);
  return newTradesCount;
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

  let sinceDate = null;
  if (!full) {
    // Get most recent deposit timestamp from DB
    const lastDeposit = await sql`
      SELECT block_ts FROM deposits
      WHERE network = ${network}
      ORDER BY block_ts DESC
      LIMIT 1
    `;
    const sinceTimestamp = lastDeposit.rows[0]?.block_ts;
    sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;
  }

  const PAGE_SIZE = 100;
  let offset = 0;
  let newDepositsCount = 0;
  const MAX_PAGES = 10;

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
    let reachedOld = false;
    for (const d of deposits) {
      if (sinceDate && new Date(d.block.block_ts) <= sinceDate) {
        console.log(`Reached old deposits at ${d.block.block_ts}, stopping`);
        reachedOld = true;
        break;
      }
      batch.push(d);
    }

    if (batch.length > 0) {
      const results = await Promise.allSettled(batch.map(d => sql`
        INSERT INTO deposits (
          network, depositor, amount, shares,
          block_height, block_ts, tx_hash, evm_tx_hash,
          vault_address, collateral_token_symbol, vault_tvl
        ) VALUES (
          ${network}, ${d.depositor}, ${d.amount}, ${d.shares},
          ${d.block.block}, ${d.block.block_ts}, ${d.txHash}, ${d.evmTxHash},
          ${d.vault.address}, ${d.vault.collateralToken.symbol}, ${d.vault.tvl}
        )
        ON CONFLICT (network, depositor, block_ts, amount) DO NOTHING
      `));
      newDepositsCount += results.filter(r => r.status === 'fulfilled' && r.value?.rowCount > 0).length;
    }

    if (reachedOld) break;
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
        network, depositor, shares, unlock_epoch, auto_redeem,
        vault_address, collateral_token_symbol
      ) VALUES (
        ${network}, ${w.depositor}, ${w.shares}, ${w.unlockEpoch}, ${w.autoRedeem},
        ${w.vault.address}, ${w.vault.collateralToken.symbol}
      )
      ON CONFLICT (network, depositor, vault_address, shares, unlock_epoch) DO NOTHING
    `));
    newWithdrawsCount += results.filter(r => r.status === 'fulfilled' && r.value?.rowCount > 0).length;

    if (withdraws.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newWithdrawsCount} new withdraws for ${network}`);
  return newWithdrawsCount;
}

export default async function handler(req, res) {
  // Require Authorization: Bearer <CRON_SECRET> on all Vercel environments.
  // Locally (no VERCEL env var) the check is skipped for convenience.
  if (process.env.VERCEL) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  if (process.env.VERCEL && !checkRateLimit(req, res, SYNC_MAX)) return;

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
        return { network: net, trades, deposits, withdraws, backfilled };
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
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

export const config = {
  maxDuration: 60  // 60 seconds for Pro plan, 10s for Hobby
};
