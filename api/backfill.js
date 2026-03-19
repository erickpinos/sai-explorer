import { sql } from '../shared/db.js';
import { nibiToHex } from '../scripts/addressUtils.js';
import { fetchGraphQL } from '../shared/graphql.js';

function sendEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function backfillTrades(network, res) {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 200;
  let offset = 0;
  let total = 0;

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const gqlRes = await fetchGraphQL(`{
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

    const trades = gqlRes.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    const results = await Promise.allSettled(trades.map(t => sql`
      INSERT INTO trades (
        id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
        tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
        trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
        collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol
      ) VALUES (
        ${t.id}, ${network}, ${t.tradeChangeType}, ${t.realizedPnlPct}, ${t.realizedPnlCollateral},
        ${t.txHash}, ${t.evmTxHash}, ${t.collateralPrice}, ${t.block.block}, ${t.block.block_ts},
        ${t.trade.trader}, ${nibiToHex(t.trade.trader)}, ${t.trade.tradeType}, ${t.trade.isLong}, ${t.trade.isOpen},
        ${t.trade.leverage}, ${t.trade.openPrice}, ${t.trade.closePrice},
        ${t.trade.collateralAmount}, ${t.trade.openCollateralAmount}, ${t.trade.tp}, ${t.trade.sl},
        ${t.trade.perpBorrowing?.marketId}, ${t.trade.perpBorrowing?.baseToken?.symbol}, ${t.trade.perpBorrowing?.collateralToken?.symbol}
      )
      ON CONFLICT (id) DO UPDATE SET
        collateral_token_symbol = EXCLUDED.collateral_token_symbol,
        base_token_symbol = EXCLUDED.base_token_symbol,
        evm_trader = EXCLUDED.evm_trader
      WHERE trades.collateral_token_symbol IS NULL
        OR trades.base_token_symbol IS NULL
        OR trades.evm_trader IS NULL
    `));

    total += results.filter(r => r.status === 'fulfilled').length;
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    sendEvent(res, { type: 'progress', table: 'trades', network, page, total });

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 100));
  }

  return total;
}

async function backfillDeposits(network, res) {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 200;
  let offset = 0;
  let total = 0;

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const gqlRes = await fetchGraphQL(`{
      lp {
        depositHistory(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: true) {
          id depositor amount shares txHash evmTxHash
          block { block block_ts }
          vault { address collateralToken { symbol } tvl }
        }
      }
    }`, network);

    const deposits = gqlRes.data?.lp?.depositHistory || [];
    if (deposits.length === 0) break;

    const results = await Promise.allSettled(deposits.map(d => sql`
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

    total += results.filter(r => r.status === 'fulfilled' && r.value?.rowCount > 0).length;
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    sendEvent(res, { type: 'progress', table: 'deposits', network, page, total });

    if (deposits.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 100));
  }

  return total;
}

async function backfillWithdraws(network, res) {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 200;
  let offset = 0;
  let total = 0;

  while (offset < MAX_PAGES * PAGE_SIZE) {
    const gqlRes = await fetchGraphQL(`{
      lp {
        withdrawRequests(limit: ${PAGE_SIZE}, offset: ${offset}, order_desc: true) {
          depositor shares unlockEpoch autoRedeem
          vault { address collateralToken { symbol } }
        }
      }
    }`, network);

    const withdraws = gqlRes.data?.lp?.withdrawRequests || [];
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

    total += results.filter(r => r.status === 'fulfilled' && r.value?.rowCount > 0).length;
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    sendEvent(res, { type: 'progress', table: 'withdraws', network, page, total });

    if (withdraws.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 100));
  }

  return total;
}

export default async function handler(req, res) {
  if (process.env.VERCEL) {
    return res.status(404).json({ error: 'Not available in production' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    sendEvent(res, { type: 'log', message: 'Starting full historical backfill (mainnet)...' });

    sendEvent(res, { type: 'log', message: 'Indexing trades...' });
    const trades = await backfillTrades('mainnet', res);
    sendEvent(res, { type: 'log', message: `Trades done: ${trades} upserted` });

    sendEvent(res, { type: 'log', message: 'Indexing deposits...' });
    const deposits = await backfillDeposits('mainnet', res);
    sendEvent(res, { type: 'log', message: `Deposits done: ${deposits} inserted` });

    sendEvent(res, { type: 'log', message: 'Indexing withdraws...' });
    const withdraws = await backfillWithdraws('mainnet', res);
    sendEvent(res, { type: 'log', message: `Withdraws done: ${withdraws} inserted` });

    sendEvent(res, {
      type: 'complete',
      message: `Backfill complete — ${trades} trades, ${deposits} deposits, ${withdraws} withdraws`,
      trades,
      deposits,
      withdraws,
    });
  } catch (err) {
    sendEvent(res, { type: 'error', message: err.message });
  } finally {
    res.end();
  }
}
