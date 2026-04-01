import { query, pool } from './db.js';
import { fetchGraphQL } from '../shared/graphql.js';
import { resolveSymbol, checkPriceDeviation } from '../shared/marketSymbols.js';
import { nibiToHex } from './addressUtils.js';

const NETWORK = 'mainnet';

// The 39 missing keeper IDs (2084–2122) identified by backfill-keeper-ids.js
const MISSING_KEEPER_IDS = [
  2084, 2085, 2086, 2087, 2088, 2089, 2090, 2091, 2092, 2093,
  2094, 2095, 2096, 2097, 2098, 2099, 2100, 2101, 2102, 2103,
  2104, 2105, 2106, 2107, 2108, 2109, 2110, 2111, 2112, 2113,
  2114, 2115, 2116, 2117, 2118, 2119, 2120, 2121, 2122,
];

async function run() {
  console.log(`=== Insert Missing Trades (${MISSING_KEEPER_IDS.length} trades) ===\n`);

  // Build market map for symbol resolution
  const marketResult = await query(
    `SELECT market_id, base_token_symbol, data FROM markets WHERE network = $1 AND base_token_symbol IS NOT NULL`,
    [NETWORK]
  );
  const marketMap = {};
  for (const row of marketResult.rows) {
    marketMap[row.market_id] = {
      symbol: row.base_token_symbol,
      price: row.data?.price ? parseFloat(row.data.price) : null,
    };
  }

  // Fetch each missing trade from the keeper by offset (offset = keeper_id - 1)
  let inserted = 0;
  let skipped = 0;

  for (const keeperId of MISSING_KEEPER_IDS) {
    const gqlRes = await fetchGraphQL(`{
      perp {
        tradeHistory(limit: 1, offset: ${keeperId - 1}, order_desc: false) {
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
    }`, NETWORK);

    const trades = gqlRes.data?.perp?.tradeHistory || [];
    const t = trades[0];

    if (!t || parseInt(t.id) !== keeperId) {
      console.log(`  ⚠ keeper_id=${keeperId}: expected id ${keeperId}, got ${t?.id ?? 'nothing'} — skipping`);
      skipped++;
      continue;
    }

    // Check if tx_hash already exists in DB (safety check)
    const existing = await query(`SELECT id FROM trades WHERE tx_hash = $1 AND network = $2`, [t.txHash, NETWORK]);
    if (existing.rows.length > 0) {
      console.log(`  ⚠ keeper_id=${keeperId}: tx_hash ${t.txHash.slice(0, 8)}... already in DB as id=${existing.rows[0].id} — skipping`);
      skipped++;
      continue;
    }

    const marketId = t.trade.perpBorrowing?.marketId;
    const keeperSymbol = t.trade.perpBorrowing?.baseToken?.symbol;
    const { symbol: resolvedSymbol } = resolveSymbol(marketId, keeperSymbol, NETWORK, marketMap);
    const placeholderId = `_k${keeperId}`;

    await query(
      `INSERT INTO trades (
        id, keeper_id, network, trade_change_type, realized_pnl_pct, realized_pnl_collateral,
        tx_hash, evm_tx_hash, collateral_price, block_height, block_ts,
        trader, evm_trader, trade_type, is_long, is_open, leverage, open_price, close_price,
        collateral_amount, open_collateral_amount, tp, sl, market_id, base_token_symbol, collateral_token_symbol,
        dev_note
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26,
        $27
      )`,
      [
        placeholderId, keeperId, NETWORK, t.tradeChangeType, t.realizedPnlPct, t.realizedPnlCollateral,
        t.txHash, t.evmTxHash, t.collateralPrice, t.block.block, t.block.block_ts,
        t.trade.trader, nibiToHex(t.trade.trader), t.trade.tradeType, t.trade.isLong, t.trade.isOpen,
        t.trade.leverage, t.trade.openPrice, t.trade.closePrice,
        t.trade.collateralAmount, t.trade.openCollateralAmount, t.trade.tp, t.trade.sl,
        marketId, resolvedSymbol, t.trade.perpBorrowing?.collateralToken?.symbol,
        `id-collision-repair: keeper_id=${keeperId}`,
      ]
    );

    console.log(`  ✓ keeper_id=${keeperId} → id=${placeholderId}  ${t.tradeChangeType}  ${resolvedSymbol || 'unknown'}  trader=${t.trade.trader.slice(0, 15)}...`);
    inserted++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n=== Done: ${inserted} inserted, ${skipped} skipped ===`);
  pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
