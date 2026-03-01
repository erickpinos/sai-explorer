import { pool } from '../scripts/db.js';
import { nibiToHex } from '../scripts/addressUtils.js';
import { fetchGraphQL } from '../shared/graphql.js';

async function syncTrades(network) {
  console.log(`Syncing trades for ${network}...`);

  // Get most recent trade timestamp from DB
  const lastTrade = await pool.query(`
    SELECT block_ts FROM trades
    WHERE network = $1
    ORDER BY block_ts DESC
    LIMIT 1
  `, [network]);

  const sinceTimestamp = lastTrade.rows[0]?.block_ts;
  const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;

  // Fetch new trades from blockchain API
  const PAGE_SIZE = 100;
  let offset = 0;
  let newTradesCount = 0;
  const MAX_PAGES = 10; // Fetch up to 1000 trades per sync

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

    // Collect new trades for batch insert
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

    if (batch.length > 0) {
      const COLS = 25;
      const placeholders = batch.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, j) => `$${i * COLS + j + 1}`).join(', ')})`
      ).join(', ');
      const params = batch.flatMap(t => [
        t.id, network, t.tradeChangeType, t.realizedPnlPct, t.realizedPnlCollateral,
        t.txHash, t.evmTxHash, t.collateralPrice, t.block.block, t.block.block_ts,
        t.trade.trader, nibiToHex(t.trade.trader), t.trade.tradeType, t.trade.isLong, t.trade.isOpen,
        t.trade.leverage, t.trade.openPrice, t.trade.closePrice,
        t.trade.collateralAmount, t.trade.openCollateralAmount, t.trade.tp, t.trade.sl,
        t.trade.perpBorrowing?.marketId, t.trade.perpBorrowing?.baseToken?.symbol, t.trade.perpBorrowing?.collateralToken?.symbol
      ]);
      try {
        await pool.query(`
          INSERT INTO trades (
            id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
            tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
            trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
            collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol
          ) VALUES ${placeholders}
          ON CONFLICT (id) DO UPDATE SET
            collateral_token_symbol = EXCLUDED.collateral_token_symbol,
            base_token_symbol = EXCLUDED.base_token_symbol,
            evm_trader = EXCLUDED.evm_trader
          WHERE trades.collateral_token_symbol IS NULL
            OR trades.base_token_symbol IS NULL
            OR trades.evm_trader IS NULL
        `, params);
        newTradesCount += batch.length;
      } catch (err) {
        console.error('Error batch inserting trades:', err);
      }
    }

    if (reachedOld) break;
    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newTradesCount} new trades for ${network}`);
  return newTradesCount;
}

async function backfillTradeSymbols(network) {
  const missing = await pool.query(`
    SELECT COUNT(*) as cnt FROM trades
    WHERE network = $1 AND collateral_token_symbol IS NULL
  `, [network]);

  const missingCount = parseInt(missing.rows[0].cnt);
  if (missingCount === 0) return 0;

  const metaKey = `backfill_done_${network}`;
  const meta = await pool.query('SELECT value FROM metadata WHERE key = $1', [metaKey]);
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

    // Batch update: collect updates and do a single query
    const updates = trades
      .map(t => ({
        id: t.id,
        symbol: t.trade?.perpBorrowing?.collateralToken?.symbol || null,
        baseSymbol: t.trade?.perpBorrowing?.baseToken?.symbol || null,
        evmTrader: nibiToHex(t.trade?.trader) || null,
      }))
      .filter(u => u.symbol || u.baseSymbol || u.evmTrader);

    if (updates.length > 0) {
      const COLS = 4;
      const valuesPlaceholders = updates.map((_, i) =>
        `($${i * COLS + 1}, $${i * COLS + 2}, $${i * COLS + 3}, $${i * COLS + 4})`
      ).join(', ');
      const params = updates.flatMap(u => [u.id, u.symbol, u.baseSymbol, u.evmTrader]);
      try {
        const result = await pool.query(`
          UPDATE trades SET
            collateral_token_symbol = COALESCE(trades.collateral_token_symbol, v.symbol),
            base_token_symbol = COALESCE(trades.base_token_symbol, v.base_symbol),
            evm_trader = COALESCE(trades.evm_trader, v.evm_trader)
          FROM (VALUES ${valuesPlaceholders}) AS v(id, symbol, base_symbol, evm_trader)
          WHERE trades.id = v.id AND trades.network = $${params.length + 1}
            AND (trades.collateral_token_symbol IS NULL OR trades.base_token_symbol IS NULL OR trades.evm_trader IS NULL)
        `, [...params, network]);
        updatedCount += result.rowCount;
      } catch (err) {
        console.error('Error batch updating trades:', err);
      }
    }

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const remainingMissing = await pool.query(`
    SELECT COUNT(*) as cnt FROM trades
    WHERE network = $1 AND collateral_token_symbol IS NULL
  `, [network]);
  const remainingCount = parseInt(remainingMissing.rows[0].cnt);
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at) VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
  `, [metaKey, String(remainingCount)]);

  console.log(`Backfilled ${updatedCount} trades for ${network} (${remainingCount} still missing)`);
  return updatedCount;
}

async function syncDeposits(network) {
  console.log(`Syncing deposits for ${network}...`);

  // Get most recent deposit timestamp from DB
  const lastDeposit = await pool.query(`
    SELECT block_ts FROM deposits
    WHERE network = $1
    ORDER BY block_ts DESC
    LIMIT 1
  `, [network]);

  const sinceTimestamp = lastDeposit.rows[0]?.block_ts;
  const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;

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

    // Collect new deposits for batch insert
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
      const COLS = 11;
      const placeholders = batch.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, j) => `$${i * COLS + j + 1}`).join(', ')})`
      ).join(', ');
      const params = batch.flatMap(d => [
        network, d.depositor, d.amount, d.shares,
        d.block.block, d.block.block_ts, d.txHash, d.evmTxHash,
        d.vault.address, d.vault.collateralToken.symbol, d.vault.tvl
      ]);
      try {
        await pool.query(`
          INSERT INTO deposits (
            network, depositor, amount, shares,
            block_height, block_ts, tx_hash, evm_tx_hash,
            vault_address, collateral_token_symbol, vault_tvl
          ) VALUES ${placeholders}
          ON CONFLICT (network, depositor, block_ts, amount) DO NOTHING
        `, params);
        newDepositsCount += batch.length;
      } catch (err) {
        console.error('Error batch inserting deposits:', err);
      }
    }

    if (reachedOld) break;
    if (deposits.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newDepositsCount} new deposits for ${network}`);
  return newDepositsCount;
}

async function syncWithdraws(network) {
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

    // Batch insert withdraws
    const COLS = 7;
    const placeholders = withdraws.map((_, i) =>
      `(${Array.from({ length: COLS }, (__, j) => `$${i * COLS + j + 1}`).join(', ')})`
    ).join(', ');
    const params = withdraws.flatMap(w => [
      network, w.depositor, w.shares, w.unlockEpoch, w.autoRedeem,
      w.vault.address, w.vault.collateralToken.symbol
    ]);
    try {
      await pool.query(`
        INSERT INTO withdraws (
          network, depositor, shares, unlock_epoch, auto_redeem,
          vault_address, collateral_token_symbol
        ) VALUES ${placeholders}
        ON CONFLICT (network, depositor, vault_address, shares, unlock_epoch) DO NOTHING
      `, params);
      newWithdrawsCount += withdraws.length;
    } catch (err) {
      console.error('Error batch inserting withdraws:', err);
    }

    if (withdraws.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newWithdrawsCount} new withdraws for ${network}`);
  return newWithdrawsCount;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    const { network } = req.body || {};

    // Sync both networks when no specific network requested (e.g. auto-sync), else sync the specified one
    const networks = !network || network === 'all' ? ['mainnet', 'testnet'] : [network];

    const allResults = await Promise.all(
      networks.map(async (net) => {
        const [trades, deposits, withdraws] = await Promise.all([
          syncTrades(net),
          syncDeposits(net),
          syncWithdraws(net)
        ]);
        const backfilled = await backfillTradeSymbols(net);
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

    // For single-network requests, also include legacy flat format
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
