import { sql } from '@vercel/postgres';

const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://sai-keeper.testnet-2.nibiru.fi/query'
};

// Bech32 decoding to convert nibi addresses to 0x
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Decode(str) {
  const data = [];
  for (let i = str.indexOf('1') + 1; i < str.length - 6; i++) {
    data.push(CHARSET.indexOf(str[i]));
  }
  let acc = 0, bits = 0;
  const bytes = [];
  for (const val of data) {
    acc = (acc << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes;
}

function nibiToHex(nibiAddr) {
  if (!nibiAddr) return null;
  try {
    const bytes = bech32Decode(nibiAddr);
    return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return nibiAddr;
  }
}

async function fetchGraphQL(query, network = 'mainnet') {
  const endpoint = GRAPHQL_ENDPOINTS[network];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return response.json();
}

async function syncTrades(network) {
  console.log(`Syncing trades for ${network}...`);

  // Get most recent trade timestamp from DB
  const lastTrade = await sql`
    SELECT block_ts FROM trades
    WHERE network = ${network}
    ORDER BY block_ts DESC
    LIMIT 1
  `;

  const sinceTimestamp = lastTrade.rows[0]?.block_ts;
  const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;

  // Fetch new trades from blockchain API
  const PAGE_SIZE = 100;
  let offset = 0;
  let newTradesCount = 0;
  const MAX_PAGES = 5; // Limit to 5 pages per sync to stay within time limit

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

    // Insert new trades
    for (const t of trades) {
      // Skip if older than our last sync
      if (sinceDate && new Date(t.block.block_ts) <= sinceDate) {
        console.log(`Reached old trades at ${t.block.block_ts}, stopping`);
        return newTradesCount;
      }

      try {
        await sql`
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
          ON CONFLICT (id) DO NOTHING
        `;
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
  const lastDeposit = await sql`
    SELECT block_ts FROM deposits
    WHERE network = ${network}
    ORDER BY block_ts DESC
    LIMIT 1
  `;

  const sinceTimestamp = lastDeposit.rows[0]?.block_ts;
  const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : null;

  const PAGE_SIZE = 100;
  let offset = 0;
  let newDepositsCount = 0;
  const MAX_PAGES = 5;

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

    for (const d of deposits) {
      if (sinceDate && new Date(d.block.block_ts) <= sinceDate) {
        console.log(`Reached old deposits at ${d.block.block_ts}, stopping`);
        return newDepositsCount;
      }

      try {
        await sql`
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
        `;
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
  const MAX_PAGES = 5;

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
        await sql`
          INSERT INTO withdraws (
            network, depositor, shares, unlock_epoch, auto_redeem,
            vault_address, collateral_token_symbol
          ) VALUES (
            ${network}, ${w.depositor}, ${w.shares}, ${w.unlockEpoch}, ${w.autoRedeem},
            ${w.vault.address}, ${w.vault.collateralToken.symbol}
          )
          ON CONFLICT (network, depositor, vault_address, shares, unlock_epoch) DO NOTHING
        `;
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
  // Verify this is a cron request (only in production)
  if (process.env.VERCEL_ENV === 'production') {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const startTime = Date.now();

    // Sync both networks in parallel
    const [mainnetResults, testnetResults] = await Promise.all([
      Promise.all([
        syncTrades('mainnet'),
        syncDeposits('mainnet'),
        syncWithdraws('mainnet')
      ]),
      Promise.all([
        syncTrades('testnet'),
        syncDeposits('testnet'),
        syncWithdraws('testnet')
      ])
    ]);

    const duration = Date.now() - startTime;

    const results = {
      success: true,
      synced_at: new Date().toISOString(),
      duration_ms: duration,
      mainnet: {
        trades: mainnetResults[0],
        deposits: mainnetResults[1],
        withdraws: mainnetResults[2]
      },
      testnet: {
        trades: testnetResults[0],
        deposits: testnetResults[1],
        withdraws: testnetResults[2]
      }
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

export const config = {
  maxDuration: 60  // 60 seconds for Pro plan, 10s for Hobby
};
