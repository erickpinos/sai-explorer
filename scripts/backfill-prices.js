import { query, pool } from './db.js';
import { fetchGraphQL } from '../shared/graphql.js';

const COIN_ID = 'liquid-staked-nibi';
const SLEEP_MS = 2500; // 2.5s between requests = ~24/min, safely under free tier limit

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCGDate(ms) {
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function fetchPrice(dateStr) {
  const key = process.env.COINGECKO_API_KEY ? `&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}` : '';
  const url = `https://api.coingecko.com/api/v3/coins/${COIN_ID}/history?date=${dateStr}&localization=false${key}`;
  const r = await fetch(url);
  if (!r.ok) {
    console.warn(`  HTTP ${r.status}`);
    return null;
  }
  const data = await r.json();
  return data.market_data?.current_price?.usd ?? null;
}

async function main() {
  // Get current epoch info from GraphQL
  console.log('Fetching current epoch info...');
  const json = await fetchGraphQL(`{
    lp {
      epochDurationDays
      vaults { currentEpoch epochStart }
    }
  }`, 'mainnet');

  const vault = json.data?.lp?.vaults?.[0];
  if (!vault) { console.error('No vault data returned'); process.exit(1); }

  const { currentEpoch, epochStart } = vault;
  const epochDurationDays = json.data.lp.epochDurationDays || 3;
  const epochDurationMs = epochDurationDays * 24 * 60 * 60 * 1000;
  const epochStartMs = epochStart / 1e6;

  console.log(`Current epoch: ${currentEpoch}`);
  console.log(`Epoch duration: ${epochDurationDays} days`);
  console.log(`Epoch start: ${new Date(epochStartMs).toISOString()}`);

  // Find the earliest deposit to use as floor date
  console.log('Fetching earliest deposit to determine vault start date...');
  const depositJson = await fetchGraphQL(`{
    lp {
      depositHistory(order_by: sequence, order_desc: false, limit: 1) {
        block { block_ts }
      }
    }
  }`, 'mainnet');

  const earliestDeposit = depositJson.data?.lp?.depositHistory?.[0];
  const floorMs = earliestDeposit?.block?.block_ts
    ? new Date(earliestDeposit.block.block_ts).getTime()
    : null;

  if (floorMs) {
    console.log(`Earliest deposit: ${new Date(floorMs).toISOString()} — skipping dates before this`);
  } else {
    console.log('Could not determine earliest deposit, fetching all dates');
  }
  console.log();

  // Get already stored dates
  const { rows: existing } = await query(
    `SELECT date FROM coingecko_prices WHERE coin_id = $1`,
    [COIN_ID]
  );
  const storedDates = new Set(existing.map(r => r.date));
  console.log(`Already stored: ${storedDates.size} dates`);

  // Build list of all epoch start dates (deduplicated — multiple epochs can share a date)
  // Only include dates on or after the earliest deposit date
  const dateSet = new Set();
  for (let i = 0; i <= currentEpoch; i++) {
    const ms = epochStartMs - (currentEpoch - i) * epochDurationMs;
    if (floorMs && ms < floorMs) continue;
    dateSet.add(formatCGDate(ms));
  }

  const toFetch = [...dateSet].filter(d => !storedDates.has(d)).sort();
  console.log(`Need to fetch: ${toFetch.length} dates`);

  if (toFetch.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  const estimatedMinutes = Math.ceil((toFetch.length * SLEEP_MS) / 60000);
  console.log(`Estimated time: ~${estimatedMinutes} minutes\n`);

  let fetched = 0;
  let skipped = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const dateStr = toFetch[i];
    process.stdout.write(`[${i + 1}/${toFetch.length}] ${dateStr} ... `);

    const price = await fetchPrice(dateStr);
    if (price != null) {
      await query(
        `INSERT INTO coingecko_prices (coin_id, date, price_usd) VALUES ($1, $2, $3) ON CONFLICT (coin_id, date) DO NOTHING`,
        [COIN_ID, dateStr, price]
      );
      console.log(`$${price}`);
      fetched++;
    } else {
      console.log('no data (token may not have existed yet)');
      skipped++;
    }

    if (i < toFetch.length - 1) await sleep(SLEEP_MS);
  }

  console.log(`\nDone. Fetched: ${fetched}, skipped: ${skipped}`);
  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
