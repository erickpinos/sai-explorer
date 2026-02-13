import { pool } from '../scripts/db.js';
import { nibiToHex } from '../scripts/addressUtils.js';

const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://testnet-sai-keeper.nibiru.fi/query'
};

async function fetchGraphQL(queryString, network = 'mainnet') {
  const endpoint = GRAPHQL_ENDPOINTS[network];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryString })
  });
  return response.json();
}

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
            perpBorrowing { marketId baseToken { symbol } }
          }
        }
      }
    }`, network);

    const trades = res.data?.perp?.tradeHistory || [];
    if (trades.length === 0) break;

    // Insert new trades
    for (const t of trades) {
      // Skip if older than our last sync
      if (sinceDate && new Date(t.block.block_ts) <= sinceDate) {
        console.log(`Reached old trades at ${t.block.block_ts}, stopping`);
        return newTradesCount;
      }

      try {
        await pool.query(`
          INSERT INTO trades (
            id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
            tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
            trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
            collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
          )
          ON CONFLICT (id) DO NOTHING
        `, [
          t.id, network, t.tradeChangeType, t.realizedPnlPct, t.realizedPnlCollateral,
          t.txHash, t.evmTxHash, t.collateralPrice, t.block.block, t.block.block_ts,
          t.trade.trader, nibiToHex(t.trade.trader), t.trade.tradeType, t.trade.isLong, t.trade.isOpen,
          t.trade.leverage, t.trade.openPrice, t.trade.closePrice,
          t.trade.collateralAmount, t.trade.openCollateralAmount, t.trade.tp, t.trade.sl,
          t.trade.perpBorrowing?.marketId, t.trade.perpBorrowing?.baseToken?.symbol
        ]);
        newTradesCount++;
      } catch (err) {
        console.error('Error inserting trade:', err);
      }
    }

    if (trades.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Synced ${newTradesCount} new trades for ${network}`);
  return newTradesCount;
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
          id depositor amount shares
          block { block block_ts }
          vault { address collateralToken { symbol } tvl }
        }
      }
    }`, network);

    const deposits = res.data?.lp?.depositHistory || [];
    if (deposits.length === 0) break;

    for (const d of deposits) {
      if (sinceDate && new Date(d.block.block_ts) <= sinceDate) {
        console.log(`Reached old deposits at ${d.block.block_ts}, stopping`);
        return newDepositsCount;
      }

      try {
        await pool.query(`
          INSERT INTO deposits (
            network, depositor, amount, shares,
            block_height, block_ts,
            vault_address, collateral_token_symbol, vault_tvl
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
          ON CONFLICT (network, depositor, block_ts, amount) DO NOTHING
        `, [
          network, d.depositor, d.amount, d.shares,
          d.block.block, d.block.block_ts,
          d.vault.address, d.vault.collateralToken.symbol, d.vault.tvl
        ]);
        newDepositsCount++;
      } catch (err) {
        console.error('Error inserting deposit:', err);
      }
    }

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

    for (const w of withdraws) {
      try {
        await pool.query(`
          INSERT INTO withdraws (
            network, depositor, shares, unlock_epoch, auto_redeem,
            vault_address, collateral_token_symbol
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
          ON CONFLICT (network, depositor, vault_address, shares, unlock_epoch) DO NOTHING
        `, [
          network, w.depositor, w.shares, w.unlockEpoch, w.autoRedeem,
          w.vault.address, w.vault.collateralToken.symbol
        ]);
        newWithdrawsCount++;
      } catch (err) {
        console.error('Error inserting withdraw:', err);
      }
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
    const { network = 'mainnet' } = req.body || {};

    // Sync the specified network
    const [tradesCount, depositsCount, withdrawsCount] = await Promise.all([
      syncTrades(network),
      syncDeposits(network),
      syncWithdraws(network)
    ]);

    const duration = Date.now() - startTime;

    const results = {
      success: true,
      synced_at: new Date().toISOString(),
      duration_ms: duration,
      network,
      trades: tradesCount,
      deposits: depositsCount,
      withdraws: withdrawsCount
    };

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
