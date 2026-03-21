import { fetchGraphQL } from '../shared/graphql.js';
import { cachedFetch } from '../shared/cache.js';
import { validateNetwork } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sql } from '../shared/db.js';
import { sendServerError } from '../shared/http.js';

// Map collateral token symbols (lowercase) to CoinGecko coin IDs
// Verify these IDs at https://www.coingecko.com if prices aren't loading
const COINGECKO_IDS = {
  nibi:    'nibiru',
  stnibi:  'liquid-staked-nibi',
  wbtc:    'wrapped-bitcoin',
  weth:    'weth',
  atom:    'cosmos',
};

function formatCGDate(epochStartNs) {
  const d = new Date(epochStartNs / 1e6);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function fetchCGHistoricalPrice(coinId, dateStr) {
  try {
    const key = process.env.COINGECKO_API_KEY ? `&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}` : '';
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${dateStr}&localization=false${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    return data.market_data?.current_price?.usd ?? null;
  } catch {
    return null;
  }
}

async function getHistoricalPrice(coinId, dateStr) {
  // Check DB first
  const { rows } = await sql`
    SELECT price_usd FROM coingecko_prices WHERE coin_id = ${coinId} AND date = ${dateStr}
  `;
  if (rows.length > 0) {
    console.log(`[coingecko] cache hit: ${coinId} ${dateStr} = $${rows[0].price_usd}`);
    return rows[0].price_usd;
  }

  // Fetch from CoinGecko and persist
  console.log(`[coingecko] fetching: ${coinId} ${dateStr}`);
  const price = await fetchCGHistoricalPrice(coinId, dateStr);
  if (price != null) {
    console.log(`[coingecko] fetched: ${coinId} ${dateStr} = $${price}`);
    await sql`
      INSERT INTO coingecko_prices (coin_id, date, price_usd)
      VALUES (${coinId}, ${dateStr}, ${price})
      ON CONFLICT (coin_id, date) DO NOTHING
    `;
  } else {
    console.log(`[coingecko] no price returned for: ${coinId} ${dateStr}`);
  }
  return price;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res)) return;

  try {
    const { network = 'mainnet' } = req.query;
    if (!validateNetwork(network, res)) return;

    const json = await cachedFetch(`lp-vaults:${network}`, () => fetchGraphQL(`{
      lp {
        epochDurationDays
        epochDurationHours
        vaults {
          address
          collateralDenom
          collateralToken {
            symbol
            name
          }
          tvl
          sharePrice
          apy
          availableAssets
          currentEpoch
          epochStart
          sharesDenom
          sharesERC20
          collateralERC20
          revenueInfo {
            RevenueCumulative
            NetProfit
            TraderLosses
            ClosedPnl
            CurrentEpochPositiveOpenPnl
            Liabilities
            Rewards
          }
        }
      }
      oracle {
        tokenPricesUsd {
          token { symbol }
          priceUsd
        }
      }
    }`, network), 60 * 1000);

    const rawVaults = json.data?.lp?.vaults || [];
    const epochDurationDays = json.data?.lp?.epochDurationDays || 7;
    const epochDurationHours = json.data?.lp?.epochDurationHours || 168;

    const tokenPrices = {};
    for (const tp of (json.data?.oracle?.tokenPricesUsd || [])) {
      if (tp.token?.symbol) {
        tokenPrices[tp.token.symbol.toLowerCase()] = tp.priceUsd || 1;
      }
    }

    // Sequential (not concurrent) to avoid hitting CoinGecko rate limits on first population.
    // In-memory cachedFetch deduplicates repeated (coinId, date) pairs within the same process.
    const vaults = [];
    for (const v of rawVaults) {
      const sym = (v.collateralToken?.symbol || '').toLowerCase();
      const isUsd = sym === 'usdc' || sym === 'usdt';
      const collateralPrice = isUsd ? 1 : (tokenPrices[sym] || 1);

      let historicalPrice = null;
      const cgId = COINGECKO_IDS[sym];
      if (!isUsd && cgId && v.epochStart) {
        const dateStr = formatCGDate(v.epochStart);
        historicalPrice = await cachedFetch(
          `coingecko:${cgId}:${dateStr}`,
          () => getHistoricalPrice(cgId, dateStr),
          24 * 60 * 60 * 1000
        );
      }

      // Build unified share price history: sync snapshots + calc from deposits
      let sharePriceHistory = [];
      let apyWindows = {};
      if (v.address) {
        // Calc entries from deposits (amount/shares)
        const { rows: depositRows } = await sql`
          SELECT
            block_ts AS ts,
            amount::float / NULLIF(shares, 0) AS share_price,
            tx_hash, evm_tx_hash
          FROM deposits
          WHERE vault_address = ${v.address}
            AND network = ${network}
            AND shares > 0
            AND amount > 0
          ORDER BY block_ts ASC
        `;

        // Sync snapshot entries
        const { rows: syncRows } = await sql`
          SELECT recorded_at AS ts, share_price
          FROM vault_share_prices
          WHERE vault_address = ${v.address}
            AND network = ${network}
          ORDER BY recorded_at ASC
        `;

        // Merge and sort all known points
        const known = [
          ...depositRows
            .filter(r => r.share_price != null)
            .map(r => ({ ts: new Date(r.ts), sharePrice: r.share_price, source: 'calc', txHash: r.tx_hash, evmTxHash: r.evm_tx_hash })),
          ...syncRows
            .map(r => ({ ts: new Date(r.ts), sharePrice: r.share_price, source: 'sync' })),
        ].sort((a, b) => a.ts - b.ts);

        // Fill in daily estimates (flat carry-forward) between known points
        if (known.length > 0) {
          const endDay = new Date();
          endDay.setUTCHours(0, 0, 0, 0);

          // Group known entries by UTC date string
          const knownByDay = {};
          for (const p of known) {
            const day = p.ts.toISOString().slice(0, 10);
            if (!knownByDay[day]) knownByDay[day] = [];
            knownByDay[day].push(p);
          }

          const startDay = new Date(known[0].ts);
          startDay.setUTCHours(0, 0, 0, 0);

          const dailyHistory = [];
          let lastKnownPrice = null;

          for (let d = new Date(startDay); d <= endDay; d.setUTCDate(d.getUTCDate() + 1)) {
            const dayStr = d.toISOString().slice(0, 10);
            if (knownByDay[dayStr]) {
              // Push all known entries for this day (no est needed)
              for (const entry of knownByDay[dayStr]) {
                dailyHistory.push(entry);
                lastKnownPrice = entry.sharePrice;
              }
            } else if (lastKnownPrice !== null) {
              // Use UTC noon so est entries render as the correct local date in all timezones
              // (UTC midnight would display as the previous day for UTC- users)
              dailyHistory.push({ ts: new Date(d.getTime() + 12 * 60 * 60 * 1000), sharePrice: lastKnownPrice, source: 'est' });
            }
          }

          sharePriceHistory = dailyHistory.map(p => ({
            ts: p.ts,
            sharePrice: p.sharePrice,
            source: p.source,
            txHash: p.txHash || null,
            evmTxHash: p.evmTxHash || null,
          }));
        }

        // Compute APY windows using the daily history
        const endPrice = v.sharePrice;
        const nowTs = Date.now();
        for (const days of [7, 14, 30, 90]) {
          if (sharePriceHistory.length === 0) continue;
          const target = nowTs - days * 24 * 60 * 60 * 1000;
          const candidates = sharePriceHistory.filter(p => new Date(p.ts).getTime() <= target);
          // Fall back to oldest available entry when history doesn't reach the full window
          const partial = candidates.length === 0;
          const startEntry = partial ? sharePriceHistory[0] : candidates[candidates.length - 1];
          const actualDays = (nowTs - new Date(startEntry.ts).getTime()) / (24 * 60 * 60 * 1000);
          const ratio = endPrice / startEntry.sharePrice;
          apyWindows[`${days}d`] = {
            apy: (Math.pow(ratio, 365 / (partial ? actualDays : days)) - 1) * 100,
            startPrice: startEntry.sharePrice,
            startTs: startEntry.ts,
            startSource: startEntry.source,
            endPrice,
            days,
            partial,
            actualDays,
          };
        }
      }

      vaults.push({ ...v, collateralPrice, historicalPrice, sharePriceHistory, apyWindows });
    }

    res.status(200).json({ vaults, epochDurationDays, epochDurationHours });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch LP vaults', error);
  }
}
