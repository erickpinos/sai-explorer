import { query } from './db.js';
import { nibiToHex } from './addressUtils.js';

const GRAPHQL_ENDPOINTS = {
  mainnet: 'https://sai-keeper.nibiru.fi/query',
  testnet: 'https://testnet-sai-keeper.nibiru.fi/query'
};

async function fetchGraphQL(query, network = 'mainnet') {
  const endpoint = GRAPHQL_ENDPOINTS[network];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return response.json();
}

async function indexAllTrades(network) {
  console.log(`\n📊 Indexing all trades for ${network}...`);

  const PAGE_SIZE = 100;
  let offset = 0;
  let totalIndexed = 0;
  const MAX_PAGES = 200; // Fetch up to 20,000 trades

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
    if (trades.length === 0) {
      console.log('  No more trades to fetch');
      break;
    }

    // Batch insert trades
    for (const t of trades) {
      try {
        await query(`
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
        totalIndexed++;
      } catch (err) {
        console.error('  Error inserting trade:', err.message);
      }
    }

    console.log(`  Indexed ${totalIndexed} trades... (page ${Math.floor(offset / PAGE_SIZE) + 1})`);

    if (trades.length < PAGE_SIZE) {
      console.log('  Reached end of trades');
      break;
    }

    offset += PAGE_SIZE;

    // Rate limiting - small delay between pages
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ Total indexed: ${totalIndexed} trades for ${network}`);
  return totalIndexed;
}

async function indexAllDeposits(network) {
  console.log(`\n📊 Indexing all deposits for ${network}...`);

  const PAGE_SIZE = 100;
  let offset = 0;
  let totalIndexed = 0;
  const MAX_PAGES = 200;

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
    if (deposits.length === 0) {
      console.log('  No more deposits to fetch');
      break;
    }

    for (const d of deposits) {
      try {
        await query(`
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
        totalIndexed++;
      } catch (err) {
        console.error('  Error inserting deposit:', err.message);
      }
    }

    console.log(`  Indexed ${totalIndexed} deposits... (page ${Math.floor(offset / PAGE_SIZE) + 1})`);

    if (deposits.length < PAGE_SIZE) {
      console.log('  Reached end of deposits');
      break;
    }

    offset += PAGE_SIZE;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ Total indexed: ${totalIndexed} deposits for ${network}`);
  return totalIndexed;
}

async function indexAllWithdraws(network) {
  console.log(`\n📊 Indexing all withdraws for ${network}...`);

  const PAGE_SIZE = 100;
  let offset = 0;
  let totalIndexed = 0;
  const MAX_PAGES = 200;

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
    if (withdraws.length === 0) {
      console.log('  No more withdraws to fetch');
      break;
    }

    for (const w of withdraws) {
      try {
        await query(`
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
        totalIndexed++;
      } catch (err) {
        console.error('  Error inserting withdraw:', err.message);
      }
    }

    console.log(`  Indexed ${totalIndexed} withdraws... (page ${Math.floor(offset / PAGE_SIZE) + 1})`);

    if (withdraws.length < PAGE_SIZE) {
      console.log('  Reached end of withdraws');
      break;
    }

    offset += PAGE_SIZE;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ Total indexed: ${totalIndexed} withdraws for ${network}`);
  return totalIndexed;
}

async function main() {
  console.log('🚀 Starting initial data indexing...\n');
  console.log('This will fetch all historical data and populate the database.');
  console.log('This may take 10-30 minutes depending on data volume.\n');

  const startTime = Date.now();

  try {
    // Index mainnet
    console.log('═══════════════════════════════════════');
    console.log('MAINNET');
    console.log('═══════════════════════════════════════');
    const mainnetTrades = await indexAllTrades('mainnet');
    const mainnetDeposits = await indexAllDeposits('mainnet');
    const mainnetWithdraws = await indexAllWithdraws('mainnet');

    // Index testnet (commented out - endpoint not available)
    // console.log('\n═══════════════════════════════════════');
    // console.log('TESTNET');
    // console.log('═══════════════════════════════════════');
    // const testnetTrades = await indexAllTrades('testnet');
    // const testnetDeposits = await indexAllDeposits('testnet');
    // const testnetWithdraws = await indexAllWithdraws('testnet');

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n═══════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Indexing completed in ${duration}s\n`);
    console.log('Mainnet:');
    console.log(`  - Trades: ${mainnetTrades}`);
    console.log(`  - Deposits: ${mainnetDeposits}`);
    console.log(`  - Withdraws: ${mainnetWithdraws}`);
    // console.log('\nTestnet:');
    // console.log(`  - Trades: ${testnetTrades}`);
    // console.log(`  - Deposits: ${testnetDeposits}`);
    // console.log(`  - Withdraws: ${testnetWithdraws}`);
    console.log('\n🎉 Database is ready! You can now run: npm run dev:fullstack');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during indexing:', error);
    process.exit(1);
  }
}

main();
