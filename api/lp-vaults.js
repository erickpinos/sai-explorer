import { fetchGraphQL } from '../shared/graphql.js';
import { cachedFetch } from '../shared/cache.js';
import { validateNetwork } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sql } from '../shared/db.js';

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

      vaults.push({ ...v, collateralPrice, historicalPrice });
    }

    res.status(200).json({ vaults, epochDurationDays, epochDurationHours });
  } catch (error) {
    console.error('Error fetching LP vaults:', error);
    res.status(500).json({ error: 'Failed to fetch LP vaults', details: error.message });
  }
}
