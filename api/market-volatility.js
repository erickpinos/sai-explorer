import { fetchGraphQL } from '../shared/graphql.js';
import { cachedFetch, invalidateCache } from '../shared/cache.js';
import { sql } from '../shared/db.js';
import { validateNetwork } from '../shared/validateParams.js';
import { checkRateLimit } from '../shared/rateLimit.js';
import { sendServerError } from '../shared/http.js';

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
const EPOCH_SECONDS  = 30;

let refreshInProgress = false;

/**
 * Fetch 24h price data from CoinGecko market_chart endpoint,
 * calculate realized volatility scaled to a 30-second epoch.
 */
async function fetchVolatility(coinId) {
  const apiKey = process.env.COINGECKO_API_KEY
    ? `&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`
    : '';
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1${apiKey}`;

  let r;
  for (const delay of [0, 3000, 6000]) {
    if (delay) await new Promise(res => setTimeout(res, delay));
    r = await fetch(url);
    if (r.status !== 429) break;
  }
  if (!r.ok) {
    console.warn(`[market-volatility] CoinGecko ${coinId}: HTTP ${r.status}`);
    return null;
  }

  const data = await r.json();
  const prices = data.prices; // [[timestamp_ms, price], ...]
  if (!prices || prices.length < 2) return null;

  // Calculate log returns and average interval
  const returns = [];
  let totalIntervalMs = 0;
  for (let i = 1; i < prices.length; i++) {
    const dt = prices[i][0] - prices[i - 1][0];
    const p0 = prices[i - 1][1];
    const p1 = prices[i][1];
    if (p0 > 0 && p1 > 0 && dt > 0) {
      returns.push(Math.log(p1 / p0));
      totalIntervalMs += dt;
    }
  }

  if (returns.length < 2) return null;

  const avgIntervalSec = (totalIntervalMs / returns.length) / 1000;

  // Realized variance per interval
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);

  // Scale to 30-second epoch
  const variancePerEpoch = variance * (EPOCH_SECONDS / avgIntervalSec);
  const volatilityPct = Math.sqrt(variancePerEpoch) * 100;

  return {
    volatility_pct: volatilityPct,
    data_points: prices.length,
    avg_interval_sec: Math.round(avgIntervalSec),
  };
}

async function refreshVolatilityFromCoinGecko(symbols) {
  if (refreshInProgress) return;
  refreshInProgress = true;
  console.log(`[market-volatility] Refreshing ${symbols.length} symbols from CoinGecko...`);
  for (const symbol of symbols) {
    const coinId = SYMBOL_TO_COINGECKO_ID[symbol];
    if (!coinId) continue;
    try {
      const vol = await fetchVolatility(coinId);
      if (!vol) continue;
      await sql`
        INSERT INTO market_volatility (symbol, coin_id, volatility_pct, data_points, avg_interval_sec, fetched_at)
        VALUES (
          ${symbol}, ${coinId},
          ${vol.volatility_pct},
          ${vol.data_points},
          ${vol.avg_interval_sec},
          NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
          coin_id          = EXCLUDED.coin_id,
          volatility_pct   = EXCLUDED.volatility_pct,
          data_points      = EXCLUDED.data_points,
          avg_interval_sec = EXCLUDED.avg_interval_sec,
          fetched_at       = EXCLUDED.fetched_at
      `;
      // 1.2s between requests → ~50 req/min, safely under demo tier limit
      await new Promise(res => setTimeout(res, 1200));
    } catch (err) {
      console.warn(`[market-volatility] Failed to refresh ${symbol}:`, err.message);
    }
  }
  refreshInProgress = false;
  invalidateCache('market_volatility:db');
  console.log(`[market-volatility] Refresh complete.`);
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

    // Read current volatility rows from DB (cached 5 min in-memory)
    const dbRows = await cachedFetch('market_volatility:db', async () => {
      const { rows } = await sql`SELECT * FROM market_volatility`;
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
      refreshVolatilityFromCoinGecko(stale).catch(e =>
        console.warn('[market-volatility] Background refresh error:', e.message)
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
        coinId:           row?.coin_id          ?? SYMBOL_TO_COINGECKO_ID[symbol] ?? null,
        volatility_pct:   row?.volatility_pct   != null ? Number(row.volatility_pct) : null,
        data_points:      row?.data_points      ?? null,
        avg_interval_sec: row?.avg_interval_sec ?? null,
        fetched_at:       row?.fetched_at       ?? null,
      };
    });

    res.status(200).json({ markets, last_updated, epoch_seconds: EPOCH_SECONDS, stale_count: stale.length });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch market volatility', error);
  }
}
