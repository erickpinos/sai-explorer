import { fetchGraphQL } from './graphql.js';
import { MARKET_METADATA } from './constants.js';

/**
 * Fetch the current market_id → { symbol, price } map from live GraphQL borrowings.
 * Combined with MARKET_METADATA (from LCD), this is the authoritative source for
 * what symbol a market_id should have.
 */
export async function fetchLiveMarketMap(network) {
  const res = await fetchGraphQL(`{
    perp {
      borrowings {
        marketId
        baseToken { symbol }
        price
      }
    }
  }`, network);

  const map = {};
  for (const b of res.data?.perp?.borrowings || []) {
    if (!map[b.marketId]) {
      map[b.marketId] = {
        symbol: b.baseToken?.symbol || null,
        price: parseFloat(b.price) || null,
      };
    }
  }
  return map;
}

/**
 * Resolve the correct base_token_symbol for a trade.
 *
 * Priority:
 * 1. MARKET_METADATA (from LCD) — authoritative for markets the keeper doesn't name correctly
 * 2. Live market map (from GraphQL borrowings) — authoritative for active markets
 * 3. Keeper-provided symbol — used only if no authoritative source exists
 *
 * Returns { symbol, flag } where flag is a string if something looks wrong, null otherwise.
 */
export function resolveSymbol(marketId, keeperSymbol, network, liveMarketMap = {}) {
  const meta = (MARKET_METADATA[network] || {})[marketId];
  const live = liveMarketMap[marketId];

  // LCD metadata is the highest authority
  if (meta) {
    const resolved = meta.ticker;
    if (keeperSymbol && keeperSymbol !== resolved) {
      return {
        symbol: resolved,
        flag: `keeper returned "${keeperSymbol}" for market ${marketId}, overridden to "${resolved}" (LCD)`,
      };
    }
    return { symbol: resolved, flag: null };
  }

  // Live borrowings are the next authority
  if (live?.symbol) {
    if (keeperSymbol && keeperSymbol !== live.symbol) {
      return {
        symbol: live.symbol,
        flag: `keeper returned "${keeperSymbol}" for market ${marketId}, overridden to "${live.symbol}" (live)`,
      };
    }
    return { symbol: live.symbol, flag: null };
  }

  // No authoritative source — use keeper symbol as-is
  return { symbol: keeperSymbol || null, flag: null };
}

// Price deviation threshold — if trade price is more than this factor away
// from the live market price, flag it. e.g. 0.9 = flag if >90% deviation.
const DEVIATION_THRESHOLD = 0.9;

/**
 * Check if a trade's price deviates significantly from the live market price
 * for the resolved symbol. Returns a warning string if suspicious, null if OK.
 *
 * This catches cases where a market_id was recycled and the stored price
 * doesn't match the symbol at all (e.g. market 12 at $369 labeled "DOGE").
 */
export function checkPriceDeviation(marketId, openPrice, resolvedSymbol, liveMarketMap = {}) {
  const live = liveMarketMap[marketId];
  if (!live?.price || !openPrice) return null;

  const tradePrice = parseFloat(openPrice);
  if (!tradePrice || !live.price) return null;

  const ratio = Math.abs(tradePrice - live.price) / live.price;
  if (ratio > DEVIATION_THRESHOLD) {
    return `price deviation: trade=${tradePrice}, live ${resolvedSymbol}=${live.price} (${(ratio * 100).toFixed(0)}% off)`;
  }
  return null;
}
