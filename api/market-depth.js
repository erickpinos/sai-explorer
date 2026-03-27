import { fetchGraphQL } from '../shared/graphql.js';
import { cachedFetch, invalidateCache } from '../shared/cache.js';
import { sql } from '../shared/db.js';
import { validateNetwork } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sendServerError } from '../shared/http.js';

// Maps base token symbols (as used in Sai markets) to CoinGecko coin IDs
const SYMBOL_TO_COINGECKO_ID = {
  AAVE:    'aave',
  ADA:     'cardano',
  APT:     'aptos',
  ARB:     'arbitrum',
  ASTER:   'aster-2',
  AVAX:    'avalanche-2',
  BNB:     'binancecoin',
  BONK:    'bonk',
  BTC:     'bitcoin',
  DOGE:    'dogecoin',
  ENA:     'ethena',
  ETH:     'ethereum',
  HYPE:    'hyperliquid',
  IP:      'story-2',
  KAITO:   'kaito',
  LINK:    'chainlink',
  LTC:     'litecoin',
  MNT:     'mantle',
  NEAR:    'near',
  NIBI:    'nibiru',
  PENGU:   'pudgy-penguins',
  POL:     'polygon-ecosystem-token',
  PUMP:    'pump-fun',
  SHIB:    'shiba-inu',
  SOL:     'solana',
  SUI:     'sui',
  TON:     'the-open-network',
  TRUMP:   'official-trump',
  TRX:     'tron',
  VIRTUAL: 'virtual-protocol',
  XRP:     'ripple',
  ZEC:     'zcash',
};

const REFRESH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_MS   =  5 * 60 * 1000;       // 5 minutes in-memory

// Guard against concurrent refresh runs
let refreshInProgress = false;

// Fetches page 1 of tickers (top exchanges by volume) with depth=true,
// sums cost_to_move_up/down_usd across all non-stale USDT pairs.
// Retries up to 3 times on 429 with exponential backoff.
async function fetchCoinDepth(coinId) {
  const apiKey = process.env.COINGECKO_API_KEY
    ? `&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`
    : '';
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/tickers?include_exchange_logo=false&page=1&depth=true${apiKey}`;

  let r;
  for (const delay of [0, 3000, 6000]) {
    if (delay) await new Promise(res => setTimeout(res, delay));
    r = await fetch(url);
    if (r.status !== 429) break;
  }
  if (!r.ok) {
    console.warn(`CoinGecko ${coinId}: HTTP ${r.status}`);
    return null;
  }
  const data = await r.json();
  const tickers = data.tickers || [];

  const usdt = tickers.filter(t => t.target === 'USDT' && !t.is_stale && !t.is_anomaly);
  if (!usdt.length) return null;

  const depthUp   = usdt.reduce((s, t) => s + (t.cost_to_move_up_usd   || 0), 0);
  const depthDown = usdt.reduce((s, t) => s + (t.cost_to_move_down_usd || 0), 0);

  return {
    depth_plus_2_percent_usd:  depthUp   || null,
    depth_minus_2_percent_usd: depthDown || null,
  };
}

// Fetches all symbols from CoinGecko sequentially (to avoid rate limiting)
// and upserts results into the market_depth table.
async function refreshDepthFromCoinGecko(symbols) {
  if (refreshInProgress) return;
  refreshInProgress = true;
  console.log(`[market-depth] Refreshing ${symbols.length} symbols from CoinGecko...`);
  for (const symbol of symbols) {
    const coinId = SYMBOL_TO_COINGECKO_ID[symbol];
    if (!coinId) continue;
    try {
      const depth = await fetchCoinDepth(coinId);
      if (!depth) {
        // Fetch failed (rate limit / error) — leave any existing DB row untouched
        // so the stale check will retry it next time.
        continue;
      }
      await sql`
        INSERT INTO market_depth (symbol, coin_id, depth_plus_2_percent_usd, depth_minus_2_percent_usd, fetched_at)
        VALUES (
          ${symbol}, ${coinId},
          ${depth.depth_plus_2_percent_usd},
          ${depth.depth_minus_2_percent_usd},
          NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
          coin_id                   = EXCLUDED.coin_id,
          depth_plus_2_percent_usd  = EXCLUDED.depth_plus_2_percent_usd,
          depth_minus_2_percent_usd = EXCLUDED.depth_minus_2_percent_usd,
          fetched_at                = EXCLUDED.fetched_at
      `;
      // 1.2s between requests → ~50 req/min, safely under the demo tier limit
      await new Promise(res => setTimeout(res, 1200));
    } catch (err) {
      console.warn(`[market-depth] Failed to refresh ${symbol}:`, err.message);
    }
  }
  refreshInProgress = false;
  invalidateCache('market_depth:db'); // force next request to re-read from DB
  console.log(`[market-depth] Refresh complete.`);
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

    // Fetch visible market symbols from GraphQL (cached 60s)
    const marketsJson = await cachedFetch(`markets:${network}`, () => fetchGraphQL(`{
      perp {
        borrowings {
          marketId
          baseToken { symbol }
          visible
        }
      }
    }`, network));

    const rawMarkets = marketsJson.data?.perp?.borrowings || [];
    const visibleMarkets = rawMarkets.filter(m => m.visible !== false);
    const symbolSet = [...new Set(visibleMarkets.map(m => m.baseToken?.symbol).filter(Boolean))];

    // Read current depth rows from DB (cached 5 min in-memory)
    const dbRows = await cachedFetch('market_depth:db', async () => {
      const { rows } = await sql`SELECT * FROM market_depth`;
      return rows;
    }, CACHE_TTL_MS);

    const dbBySymbol = Object.fromEntries(dbRows.map(r => [r.symbol, r]));

    // Find symbols that are missing or stale (> 24h)
    const now = Date.now();
    const stale = symbolSet.filter(sym => {
      if (!SYMBOL_TO_COINGECKO_ID[sym]) return false;
      const row = dbBySymbol[sym];
      if (!row) return true;
      return now - new Date(row.fetched_at).getTime() > REFRESH_TTL_MS;
    });

    if (stale.length > 0) {
      // Refresh stale symbols in the background — don't block the response
      refreshDepthFromCoinGecko(stale).catch(e =>
        console.warn('[market-depth] Background refresh error:', e.message)
      );
    }

    // Compute last_updated from the oldest fetched_at among DB rows for visible symbols
    const fetchedAts = symbolSet
      .map(s => dbBySymbol[s]?.fetched_at)
      .filter(Boolean)
      .map(d => new Date(d).getTime());
    const last_updated = fetchedAts.length > 0
      ? new Date(Math.min(...fetchedAts)).toISOString()
      : null;

    // Build per-market response
    const markets = visibleMarkets.map(m => {
      const symbol = m.baseToken?.symbol || null;
      const row = symbol ? dbBySymbol[symbol] : null;
      return {
        marketId: m.marketId,
        symbol,
        coinId:                    row?.coin_id                    ?? SYMBOL_TO_COINGECKO_ID[symbol] ?? null,
        depth_plus_2_percent_usd:  row?.depth_plus_2_percent_usd  ?? null,
        depth_minus_2_percent_usd: row?.depth_minus_2_percent_usd ?? null,
        fetched_at:                row?.fetched_at                 ?? null,
      };
    });

    res.status(200).json({ markets, last_updated, stale_count: stale.length });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch market depth', error);
  }
}
